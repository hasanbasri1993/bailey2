let {
    WAConnection,
    MessageType,
    ReconnectMode,
    waChatKey,
} = require("@adiwajshing/baileys");
const fs = require('fs');
const {placeSendWebhookOrder} = require("./worker");
const {runDialog} = require("./dialog");
const {creteUser} = require("./firebase");
const {getUrlProfilePicture} = require("./firebase");
const {creteUsersGroup} = require("./firebase");
const {newMessageChat} = require("./firebase");
const {presence} = require("./firebase");
const myLog = false

global.conn = new WAConnection()

function getFilename(url) {
    const filename = decodeURIComponent(new URL(url).pathname.split('/').pop());
    if (!filename) return 'index.html'; // some default filename
    return filename;
}

function runDialogs(data) {
    if (!data['key'].fromMe) runDialog(data['message'].conversation, data['key'].remoteJid).then()
     placeSendWebhookOrder(data, process.env.webhook)
        .then((job) =>
            console.log("🍳 Your order will be ready in a while for placeSendWebhookOrder, order id " + job.id)
        )
        .catch(() => console.log("Your order could not be placed")
        );
}


async function instance1() {
    conn.autoReconnect = ReconnectMode.onConnectionLost // only automatically reconnect when the connection breaks
    conn.logger.level = 'debug' // set to 'debug' to see what kind of stuff you can implement
    // attempt to reconnect at most 10 times in a row
    conn.connectOptions.maxRetries = 10
    conn.chatOrderingKey = waChatKey(true) // order chats such that pinned chats are on top
    conn.on('chats-received', ({hasNewChats}) => {
        console.log(`you have ${conn.chats.length} chats, new chats available: ${hasNewChats}`)
    })
    conn.on('contacts-received', () => {
        console.log(`you have ${Object.keys(conn.contacts).length} contacts`)
    })
    conn.on('initial-data-received', () => {
        console.log('received all initial messages')
    })

    // loads the auth file credentials if present
    /*  Note: one can take this auth_info.json file and login again from any computer without having to scan the QR code,
        and get full access to one's WhatsApp. Despite the convenience, be careful with this file */
    fs.existsSync('./auth_info.json') && conn.loadAuthInfo('./auth_info.json')
    // uncomment the following line to proxy the connection; some random proxy I got off of: https://proxyscrape.com/free-proxy-list
    //conn.connectOptions.agent = ProxyAgent ('http://1.0.180.120:8080')
    await conn.connect()
    // credentials are updated on every connect
    const authInfo = conn.base64EncodedAuthInfo() // get all the auth info we need to restore this session
    fs.writeFileSync('./auth_info.json', JSON.stringify(authInfo, null, '\t')) // save this info to a file

    console.log('oh hello ' + conn.user.name + ' (' + conn.user.jid + ')')
    // uncomment to load all unread messages
    //const unread = await conn.loadAllUnreadMessages ()
    //console.log ('you have ' + unread.length + ' unread messages')

    /**
     * The universal event for anything that happens
     * New messages, updated messages, read & delivered messages, participants typing etc.
     */
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
                await newMessageChat(m, false, m.message.extendedTextMessage.contextInfo)
                if (myLog) {
                    console.log("")
                    console.log("--------> contextInfo <-------")
                    console.log(m.message.extendedTextMessage.contextInfo)
                    console.log("--------> contextInfo close <-------")
                    console.log("")
                }
            } else if (messageType === MessageType.text || messageType === MessageType.extendedText) {
                await newMessageChat(m)
                if (myLog) {
                    console.log("")
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
                // google dialog flow
                runDialogs(m)
            } else {
                try {
                    if (m.key.remoteJid !== "status@broadcast") {
                        const savedFile = await conn.downloadAndSaveMediaMessage(m, './tmp/media_in_' + m.key.id, true)
                        for (const obj in m.message) {
                            if (m.message[obj] !== null)
                                if (m.message[obj].contextInfo !== undefined) {
                                    await newMessageChat(m, savedFile, m.message[obj].contextInfo)
                                }
                        }
                        await newMessageChat(m, savedFile)
                    }
                } catch (err) {
                    console.log('error in decoding message: ' + err)
                }
            }
        }
    })

    /* example of custom functionality for tracking battery */
    conn.on('CB:action,,battery', json => {
        const batteryLevelStr = json[2][0][1].value
        const batterylevel = parseInt(batteryLevelStr)
        console.log('battery level: ' + batterylevel)
    })
    conn.on('close', ({reason, isReconnecting}) => (
        console.log('oh no got disconnected: ' + reason + ', reconnecting: ' + isReconnecting)
    ))
}

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
    instance1,
    BODY_CHECK,
    checkIsOnWhatsApp,
    getFilename
}
