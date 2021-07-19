const app = require('firebase/app')
require('firebase/firestore')
require('firebase/database')
require('firebase/storage')

const fs = require("fs");
const {placeChatwootOrder} = require("./worker");
const {getImage} = require("./worker");
global.XMLHttpRequest = require('xhr2');
const config = {
    apiKey: process.env.apiKey,
    projectId: process.env.projectId,
    storageBucket: process.env.storageBucket,
    appId: process.env.appId
}

app.initializeApp(config)

const firebase = app
const db = app.firestore()
const storageRef = app.storage().ref()
const usersRef = db.collection('users')
const roomsRef = db.collection('chatRooms')
const messagesRef = roomId => roomsRef.doc(roomId).collection('messages')
const myNumber = process.env.USERID
const myName = process.env.USERNAME
const filesRef = storageRef.child('files')
const dbTimestamp = firebase.firestore.FieldValue.serverTimestamp()


// upload media file to firebase storage o return url and meta from file in tmp
const uploadFile = async (name, file, messageId) => {
    const buff = fs.readFileSync(messageId);
    const mime = file.mimetype.split("/")
    const uploadFileRef = filesRef
        .child('medias')
        .child(`${name}.${mime[1]}`)
    await uploadFileRef.put(buff, {contentType: file.mimetype})
    return {
        "url": await uploadFileRef.getDownloadURL(),
        "metadata": await uploadFileRef.getMetadata()
    }
}

const newMessageChat = (async (request, file = false, contextInfo = false) => {
    let audio = false
    let fileTemp,
        media,
        message,
        chatId = request['key'].remoteJid.replace("@s.whatsapp.net", ""),
        sender_id = request['key'].fromMe ? myNumber : chatId

    // group there participant
    if (request.participant !== "") {
        chatId = request['key'].remoteJid
        sender_id = request.participant.replace("@s.whatsapp.net", "")
    }

    // media message
    if (file) {
        if (request['message'].imageMessage)
            media = request['message'].imageMessage
        if (request['message'].videoMessage)
            media = request['message'].videoMessage
        if (request['message'].audioMessage) {
            media = request['message'].audioMessage
            audio = true
        }
        if (request['message'].documentMessage)
            media = request['message'].documentMessage

        // media upload to firebase storag to return
        // fileReturn = {
        //             duration: request['message'].audioMessage.seconds,
        //             audio: true,
        //             url: temp['url'],
        //             extension: "audio/mp3",
        //             type: "audio/mp3",
        //             name: temp['metadata'].name,
        //             size: temp['metadata'].size,
        // }

        fileTemp = await uploadFileFirebase(request, media, file, audio)
        message = {
            waid: JSON.stringify(request),
            message_id: request['key'].id,
            sender_id: sender_id,
            content: media.caption !== undefined ? media.caption : fileTemp.name,
            file: fileTemp,
            timestamp: new Date()
        }

        //is audio ppt
        if (audio)
            message["file"] = {
                waid: JSON.stringify(request),
                duration: request['message'].audioMessage.seconds,
                audio: true,
                url: fileTemp['url'],
                extension: "audio/mp3",
                type: "audio/mp3",
                name: fileTemp.name,
                size: fileTemp.size,
            }

        // there replyMessage or quote
        if (contextInfo)
            message["replyMessage"] = await contextInfoCheck(contextInfo, chatId)
        sendMsg(message, chatId)
    }
    // non media message
    else {
        message = {
            waid: JSON.stringify(request),
            message_id: request['key'].id,
            sender_id: sender_id,
            content: request['message'].conversation !== "" ? request['message'].conversation : request['message'].extendedTextMessage.text,
            timestamp: new Date()
        }

        // there replyMessage or quote
        if (contextInfo)
            message["replyMessage"] = await contextInfoCheck(contextInfo, chatId)
        sendMsg(message, chatId)
    }

});

// replyMessage or quote
async function contextInfoCheck(contextInfo, chatId) {
    const messagesRefId = messagesRef(chatId).doc(contextInfo.stanzaId)
    const message = await messagesRefId.get()
    if (message.exists)
        return message.data()
}

async function uploadFileFirebase(request, media, file, isAudio = false) {
    const temp = await uploadFile(request['key'].id, media, file)
    const mime = media.mimetype.split("/")

    // ppt media file
    if (isAudio)
        return {
            duration: request['message'].audioMessage.seconds,
            audio: true,
            url: temp['url'],
            extension: "audio/mp3",
            type: "audio/mp3",
            name: temp['metadata'].name,
            size: temp['metadata'].size,
        }
    return {
        url: temp['url'],
        type: mime[1],
        name: temp['metadata'].name,
        size: temp['metadata'].size,
    }
}


const sendMsg = ((req, chatId) => {

    const messagesRefId = messagesRef(chatId).doc(req['message_id'])
    messagesRefId.get()
        .then(async (docSnapshot) => {
            if (docSnapshot.exists) {
                messagesRef(chatId).doc(req['message_id']).update(req).then()
            } else {
                placeChatwootOrder({
                    number: chatId,
                    content: req,
                    order: "prepareSendMessage"
                })
                messagesRef(chatId).doc(req['message_id']).set(req).then()
            }
        });

    roomsRef.doc(chatId).update({
        lastMessage: req,
    }).then()
})

const creteUsersGroup = (async (req) => {
    let users = [];
    for (let i = 0; i < req['participants'].length; i++) {
        const user = req['participants'][i].jid.replace("@s.whatsapp.net", "")
        const userRefId = usersRef.doc(user)
        const userDb = await userRefId.get()
        if (!userDb.exists) {
            let imgUrl = await getUrlProfilePicture(user)
            creteUser(
                {
                    chatId: user,
                    name: req['participants'][i].name,
                    image: imgUrl
                })
        }
        users.push(user)
    }

    await usersRef.doc(req['id']).update(
        {
            _id: req['id'],
            username: req['subject'],
            avatar: req['avatar'],
            owner: req['owner'],
            creation: new Date(req['creation'] * 1000),
        })

    roomsRef.doc(req['id']).update({
        detail: {
            _id: req['id'],
            username: req['subject'],
            avatar: req['avatar'],
            owner: req['owner'],
            creation: new Date(req['creation'] * 1000),
        },
    }).then()
})

const creteUser = ((req) => {
    let chatId = req['chatId'].replace("@s.whatsapp.net", "");
    roomsRef.doc(chatId).update({
        users: [myNumber, chatId],
        lastUpdated: new Date(),
        typingUsers: []
    }).then()

    roomsRef.doc(chatId).update({
        detail: {
            _id: chatId,
            username: req['name'] !== undefined ? req['name'] : chatId,
            avatar: req['image'] !== undefined ? req['image'] : ""
        },
    }).then()

    usersRef.doc(myNumber).set(
        {
            _id: myNumber,
            username: myName,
            avatar: "https://res.cloudinary.com/dqq8siyfu/h_60,q_auto:good/wp-cdn/2019/01/logodu.png"
        }).then()

    usersRef.doc(chatId).set(
        {
            _id: chatId,
            username: req['name'] !== undefined ? req['name'] : chatId,
            avatar: req['image'] !== undefined ? req['image'] : ""
        }).then()

    placeChatwootOrder({
        number: chatId,
        name: req['name'] !== undefined ? req['name'] : chatId,
        order: "createContact"
    })
})


//presence
const presence = (async (req) => {
    let participant, presence, chatId

    //jid empty, will return false
    if (req['jid'] === null) return false;

    //group jid
    if (req['jid'].indexOf("@g.us") !== -1)
        chatId = req['jid']

    //user jid
    chatId = req['jid'].replace("@s.whatsapp.net", "");

    //group presences
    for (const obj in req['presences']) {
        participant = obj.replace("@s.whatsapp.net", "");
        presence = req['presences'][obj]['lastKnownPresence'].replace("available", "online")

        //not send presence to firebase if user not exists and will return false
        const userRefId = usersRef.doc(participant)
        const userDb = await userRefId.get()
        if (!userDb.exists) return false;
    }

    presence = presence.replace("unavailable", "offline")

    //user presence composing
    if (presence === "composing") {
        //update typingUsers room
        await roomsRef.doc(chatId).update({
            typingUsers: [participant],
        })

        //update lastSeen user
        await usersRef.doc(participant).update({
            status: {
                state: presence,
                lastChanged: req['lastSeen'] !== undefined ? req['lastSeen'] : dbTimestamp,
            }
        })
    } else {
        await roomsRef.doc(chatId).update({
            typingUsers: [],
        })
        await usersRef.doc(participant).update({
            status: {
                state: presence,
                lastChanged: req['lastSeen'] !== undefined ? req['lastSeen'] : dbTimestamp,
            }
        })
    }
})

//update acknowledge to messages
const acknowledge = (async (req) => {
    let chatId = req['to'].replace("@s.whatsapp.net", "");
    const userRefId = usersRef.doc(chatId)
    const userDb = await userRefId.get()
    if (!userDb.exists) return false;
    let type = req['type']
    switch (type) {
        case 4: //read
            req['ids'].forEach(function (id) {
                setTimeout(function () {
                    sendMsg({seen: true, message_id: id}, chatId)
                }, 1)
            });
            break;

        case 3: //delivery
            req['ids'].forEach(function (id) {
                setTimeout(function () {
                    sendMsg({distributed: true, message_id: id}, chatId)
                }, 1)
            });
            break;
        case 2: //server
            req['ids'].forEach(function (id) {
                setTimeout(function () {
                    sendMsg({saved: true, message_id: id}, chatId);
                }, 1)
            });
            break;
        default:
    }
})

async function getUrlProfilePicture(Jid) {

    let imgUrl = await conn.getProfilePicture(Jid)
        .catch((err) => console.log(`metadata error: ${err}`))
    const uploadFileRef = filesRef.child(`pp/${Jid}.jpg`)
    if (imgUrl !== undefined) {
        getImage(imgUrl, async function (err, file) {
            await uploadFileRef.put(file, {contentType: "image/jpeg"})
        });
        return await uploadFileRef.getDownloadURL()
    }
}

module.exports = {
    getUrlProfilePicture,
    filesRef,
    newMessageChat,
    creteUser,
    acknowledge,
    presence,
    creteUsersGroup
}
