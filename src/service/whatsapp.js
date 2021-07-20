let {
    WAConnection,
    MessageType,
    ReconnectMode,
    waChatKey,
} = require("@adiwajshing/baileys");
const fs = require('fs');
const {getActiveInstance} = require("./db");
const {placeSendWebhookOrder} = require("./worker");
const {runDialog} = require("./dialog");
const {creteUser} = require("./firebase");
const {getUrlProfilePicture} = require("./firebase");
const {creteUsersGroup} = require("./firebase");
const {newMessageChat} = require("./firebase");
const {presence} = require("./firebase");
const myLog = true

global.conn = new WAConnection()
global.connswa = []
global.instanceData = []


const runWhatsappInstance = async () => {
    getActiveInstance(async function (result) {
        for (let n = 0; n < result.length; n++) {
            let buff = Buffer.from(result[n].session, 'base64');
            fs.writeFileSync(`./${result[n].name}.json`, buff) // save this info to a file
           // const session = mkZap(`./${result[n].name}.json`, result[n])
            //connswa.push({name: result[n].id, session})
            instanceData.push(result[n])
        }
        console.log("runWhastappInstance")
        console.log(connswa)
        console.log("===================")
    });
}


const mkZap = async (credential, data) => {
    const conn = new WAConnection()
    //conn.logger.level = 'debug'
    if (credential) {
        conn.loadAuthInfo(credential)
        conn.on('chat-update', async chat => {
            if (chat.presences) { // receive presence updates -- composing, available, etc.
                presence(chat).then()
                if (myLog)
                    Object.values(chat.presences).forEach(presence => console.log(`${presence.name}'s presence is ${presence.lastKnownPresence} in ${chat.jid}`))
            }

            // only do something when a new message is received
            if (!chat.hasNewMessage) return

            const m = chat.messages.all()[0] // pull the new message from the update
            const messageContent = m.message
            if (m.key.remoteJid !== "status@broadcast") {
                if (!messageContent) return
                const messageType = Object.keys(messageContent)[0] // message will always contain one key signifying what kind of message
                if (m.message.extendedTextMessage && m.message.extendedTextMessage.contextInfo) { // if its a reply to a
                    // previous message
                    //await newMessageChat(m, false, m.message.extendedTextMessage.contextInfo)
                    if (myLog) {
                        console.log("")
                        console.log(data.name)
                        console.log("--------> contextInfo <-------")
                        console.log(m.message.extendedTextMessage.contextInfo)
                        console.log("--------> contextInfo close <-------")
                        console.log("")
                    }
                } else if (messageType === MessageType.text || messageType === MessageType.extendedText) {
                    // google dialog flow
                    console.log("prepare runDialog")
                    runDialogs(m, data.id)
                    //await newMessageChat(m)
                    if (myLog) {
                        console.log("")
                        console.log(data.name)
                        console.log("--------> chat <-------")
                        console.log(m)
                        console.log("--------> chat close <-------")
                        console.log("")
                    }
                    if (m.key.remoteJid.indexOf("@g.us") !== -1) {
                        let imgUrl = await getUrlProfilePicture(m.key.remoteJid)
                        conn.groupMetadata(m.key.remoteJid).then(metadata => {
                            metadata["avatar"] = imgUrl !== undefined ? imgUrl : ""
                            creteUsersGroup(metadata)
                            if (myLog) {
                                console.log("")
                                console.log(data.name)
                                console.log("--------> metadata <-------")
                                console.log(metadata)
                                console.log("--------> metadata close <-------")
                                console.log("")
                            }
                        })
                    } else {
                        let imgUrl = await getUrlProfilePicture(chat.jid)
                        conn.getProfilePicture(chat.jid).then(() => {
                            let data = {
                                "chatId": chat.jid,
                                "name": conn.chats.get(m.key.remoteJid).name,
                                "image": imgUrl !== undefined ? imgUrl : ""
                            }
                            creteUser(data)
                        })
                    }

                } else {
                    try {
                        if (m.key.remoteJid !== "status@broadcast") {
                            const savedFile = await conn.downloadAndSaveMediaMessage(m, './tmp/media_in_' + m.key.id, true)
                            for (const obj in m.message) {
                                if (m.message[obj] !== null)
                                    if (m.message[obj].contextInfo !== undefined) {
                                        // await newMessageChat(m, savedFile, m.message[obj].contextInfo)
                                    }
                            }
                            //await newMessageChat(m, savedFile)
                        }
                    } catch (err) {
                        console.log('error in decoding message: ' + err)
                    }
                }
            }
        })
    }
    await conn.connect()
    return conn
}

function getFilename(url) {
    const filename = decodeURIComponent(new URL(url).pathname.split('/').pop());
    if (!filename) return 'index.html'; // some default filename
    return filename;
}

function runDialogs(data, instanceId) {
    let index = connswa.findIndex(x => x.name === parseInt(instanceId))
    console.log("oder runDialogs")
    console.log(instanceId)
    console.log(index)
    if (!data['key'].fromMe) runDialog(data['message'].conversation, data['key'].remoteJid, index).then()
    // placeSendWebhookOrder(data, process.env.webhook)
    //     .then((job) =>
    //         console.log("🍳 Your order will be ready in a while for placeSendWebhookOrder, order id " + job.id)
    //     )
    //     .catch(() => console.log("Your order could not be placed")
    //     );
}


// async function instance1(data) {
//     conn.autoReconnect = ReconnectMode.onConnectionLost // only automatically reconnect when the connection breaks
//     //conn.logger.level = 'debug' // set to 'debug' to see what kind of stuff you can implement
//     // attempt to reconnect at most 10 times in a row
//     conn.connectOptions.maxRetries = 10
//     conn.chatOrderingKey = waChatKey(true) // order chats such that pinned chats are on top
//     conn.on('chats-received', ({hasNewChats}) => {
//         console.log(`${data.name} have ${conn.chats.length} chats, new chats available: ${hasNewChats}`)
//     })
//     conn.on('contacts-received', () => {
//         console.log(`${data.name} have ${Object.keys(conn.contacts).length} contacts`)
//     })
//     conn.on('initial-data-received', () => {
//         console.log(`${data.name} received all initial messages`)
//     })
//
//     // loads the auth file credentials if present
//     /*  Note: one can take this auth_info.json file and login again from any computer without having to scan the QR code,
//         and get full access to one's WhatsApp. Despite the convenience, be careful with this file */
//     // fs.existsSync(`./${auth}.json`) && conn.loadAuthInfo(`./${auth}.json`)
//
//
//     let buff = Buffer.from(data.session, 'base64');
//     console.log(buff)
//     fs.writeFileSync(`./${data.name}.json`, buff) // save this info to a file
//     conn.loadAuthInfo(`./${data.name}.json`)
//
//     // uncomment the following line to proxy the connection; some random proxy I got off of: https://proxyscrape.com/free-proxy-list
//     //conn.connectOptions.agent = ProxyAgent ('http://1.0.180.120:8080')
//     await conn.connect()
//     // credentials are updated on every connect
//     //const authInfo = conn.base64EncodedAuthInfo() // get all the auth info we need to restore this session
//     //fs.writeFileSync(`./${auth}.json`, JSON.stringify(authInfo, null, '\t')) // save this info to a file
//
//     console.log('oh hello ' + conn.user.name + ' (' + conn.user.jid + ')')
//     // uncomment to load all unread messages
//     //const unread = await conn.loadAllUnreadMessages ()
//     //console.log ('you have ' + unread.length + ' unread messages')
//
//     /**
//      * The universal event for anything that happens
//      * New messages, updated messages, read & delivered messages, participants typing etc.
//      */
//     conn.on('chat-update', async chat => {
//         if (chat.presences) { // receive presence updates -- composing, available, etc.
//             presence(chat).then()
//             if (myLog)
//                 Object.values(chat.presences).forEach(presence => console.log(`${presence.name}'s presence is ${presence.lastKnownPresence} in ${chat.jid}`))
//         }
//
//         // only do something when a new message is received
//         if (!chat.hasNewMessage) return
//
//         const m = chat.messages.all()[0] // pull the new message from the update
//         const messageContent = m.message
//         if (m.key.remoteJid !== "status@broadcast") {
//             if (!messageContent) return
//             const messageType = Object.keys(messageContent)[0] // message will always contain one key signifying what kind of message
//             if (m.message.extendedTextMessage && m.message.extendedTextMessage.contextInfo) { // if its a reply to a
//                 // previous message
//                 await newMessageChat(m, false, m.message.extendedTextMessage.contextInfo)
//                 if (myLog) {
//                     console.log("")
//                     console.log(data.name)
//                     console.log("--------> contextInfo <-------")
//                     console.log(m.message.extendedTextMessage.contextInfo)
//                     console.log("--------> contextInfo close <-------")
//                     console.log("")
//                 }
//             } else if (messageType === MessageType.text || messageType === MessageType.extendedText) {
//                 await newMessageChat(m)
//                 if (myLog) {
//                     console.log("")
//                     console.log(data.name)
//                     console.log("--------> chat <-------")
//                     console.log(m)
//                     console.log("--------> chat close <-------")
//                     console.log("")
//                 }
//                 if (m.key.remoteJid.indexOf("@g.us") !== -1) {
//                     let imgUrl = await getUrlProfilePicture(m.key.remoteJid)
//                     conn.groupMetadata(m.key.remoteJid).then(metadata => {
//                         metadata["avatar"] = imgUrl !== undefined ? imgUrl : ""
//                         creteUsersGroup(metadata)
//                         if (myLog) {
//                             console.log("")
//                             console.log(data.name)
//                             console.log("--------> metadata <-------")
//                             console.log(metadata)
//                             console.log("--------> metadata close <-------")
//                             console.log("")
//                         }
//                     })
//                 } else {
//                     let imgUrl = await getUrlProfilePicture(chat.jid)
//                     conn.getProfilePicture(chat.jid).then(() => {
//                         let data = {
//                             "chatId": chat.jid,
//                             "name": conn.chats.get(m.key.remoteJid).name,
//                             "image": imgUrl !== undefined ? imgUrl : ""
//                         }
//                         creteUser(data)
//                     })
//                 }
//                 // google dialog flow
//                 runDialogs(m)
//             } else {
//                 try {
//                     if (m.key.remoteJid !== "status@broadcast") {
//                         const savedFile = await conn.downloadAndSaveMediaMessage(m, './tmp/media_in_' + m.key.id, true)
//                         for (const obj in m.message) {
//                             if (m.message[obj] !== null)
//                                 if (m.message[obj].contextInfo !== undefined) {
//                                     await newMessageChat(m, savedFile, m.message[obj].contextInfo)
//                                 }
//                         }
//                         await newMessageChat(m, savedFile)
//                     }
//                 } catch (err) {
//                     console.log('error in decoding message: ' + err)
//                 }
//             }
//         }
//     })
//
//     conn.on('close', ({reason, isReconnecting}) => (
//         console.log('oh no got disconnected: ' + reason + ', reconnecting: ' + isReconnecting)
//     ))
// }

const BODY_CHECK = function (BODY) {
    return new Promise(function (resolve) {
        if (typeof BODY['chatId'] !== 'undefined') {
            if (BODY['chatId'].indexOf("@c.us") !== -1 ||
                BODY['chatId'].indexOf("@s.whatsapp.net") !== -1 ||
                BODY['chatId'].indexOf("@g.us") !== -1)
                resolve({status: true, chatId: BODY['chatId']});
            resolve({status: false});
        } else {
            if (typeof BODY['phone'] !== 'undefined') {
                resolve({status: true, chatId: BODY['phone'] + "@c.us"});
            } else {
                resolve({status: false});
            }
        }
    }).catch((err) => {
        console.log(err);
    });
}


async function checkIsOnWhatsApp(processData) {
    let exists
    if (processData.indexOf("@g.us") === -1) {
        exists = await conn.isOnWhatsApp(processData).catch(err => console.log(err))
    } else {
        exists = await conn.groupMetadata(processData).catch(err => console.log(err))
    }
    return exists
}

module.exports = {
    //instance1,
    BODY_CHECK,
    checkIsOnWhatsApp,
    getFilename,
    runWhatsappInstance
}
