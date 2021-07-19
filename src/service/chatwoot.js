const ChatwootClient = require('@chatwoot/node')

let config = {
    host: process.env.hostChatwoot,
    apiAccessToken:  process.env.apiAccessToken,
    apiVersion: process.env.apiVersion,
    accountId: process.env.accountIdChatwoot,
    inboxId: process.env.inboxIdChatwoot
}

const Chatwoot = new ChatwootClient({config})

const myNumber = process.env.USERID

const createContact = async (number, req, isContent = null) => {
    try {
        const {data} = await Chatwoot.contacts(config.accountId).search(number)
        if (data.payload.length !== 0) {
            const returnUpdate = await Chatwoot.contacts(config.accountId).update(data.payload[0].id, {
                name: req !== undefined ? req : `+${number}`
            })
            return returnUpdate.data;
        } else {
            const params = {
                inbox_id: config.inboxId,
                source_id: `+${number}`,
                name: req,
                email: `${number}_email@gmail.com`,
                phone_number: `+${number}`
            };

            try {
                const {data} = await Chatwoot.contacts(config.accountId).create(params)
                if (isContent != null) return await setConversation(data.payload.contact.id, isContent)
            } catch (e) {
                console.log(e);
            }
        }
    } catch (error) {
        console.log(error);
    }
}

async function sendMessage(conversationId, content) {
    try {
        config['apiAccessToken'] = 'pCDJMUPjmE3T3eu8ge3uSEod'
        const Chatwoot = new ChatwootClient({config})
        const type = content.sender_id === myNumber ? 'outgoing' : 'incoming'
        const params = {
            content: content.content,
            message_type: type,
            private: false
        }
        if (content.content.indexOf("#chatwoot") === -1) {
            if (content.file !== undefined) {
                const {data} = await Chatwoot.conversations(config.accountId).sendMessage(conversationId, params, `./tmp/media_in_${content.file.name}`)
                return data
            } else {
                const {data} = await Chatwoot.conversations(config.accountId).sendMessage(conversationId, params)
                return data
            }

        }

    } catch (error) {
        console.log(error)
    }
}

const setConversation = async (contactId, content) => {
    try {
        const {data} = await Chatwoot.contacts(config.accountId).getConversationsByContactId(contactId)
        if (data.payload.length !== 0)
            return await sendMessage(data.payload[0].id, content)
        else {
            const params = {
                source_id: contactId,
                inbox_id: config.inboxId,
                contact_id: contactId,
                additional_attributes: {},
                status: "open"
            };
            const {data} = await Chatwoot.conversations(config.accountId).create(params)
            return await sendMessage(data.id, content)
        }
    } catch (error) {
        console.log(error);
    }
}

const prepareSendMessage = async (number, content) => {
    try {
        const {data} = await Chatwoot.contacts(config.accountId).search(number)
        if (data.payload.length !== 0) {
            return await setConversation(data.payload[0].id, content)
        } else {
            return await createContact(number, number, content)
        }
    } catch (error) {
        console.log(error);
    }
}

//const testNumber = 6282213542319

// prepareSendMessage(testNumber, {
//         waid: '98',
//         message_id: '3EB07B10F28B52508227',
//         sender_id: '6282213542319',
//         content: '',
//         file: {
//             url: 'https://firebasestorage.googleapis.com/v0/b/baileys-client.appspot.com/o/files%2Fmedias%2F3EB07B10F28B52508227.jpeg?alt=media&token=eb077e6a-1211-494c-9512-15967d689377',
//             type: 'jpeg',
//             name: '3EB07B10F28B52508227.jpeg',
//             size: 109886
//         },
//         timestamp: '2021-07-14T07:14:03.780Z'
//     }
//     , true).then(r => {
//     console.log(r)
// })

// sendMessage(1, {
//     waid: '98',
//     message_id: '3EB0274285E188CEF805',
//     sender_id: '6282213542319',
//     content: 'ddddd',
//     file: {
//         url: 'https://firebasestorage.googleapis.com/v0/b/baileys-client.appspot.com/o/files%2Fmedias%2F3EB07B10F28B52508227.jpeg?alt=media&token=eb077e6a-1211-494c-9512-15967d689377',
//         type: 'jpeg',
//         name: '3EB07EBA977370E686AF.jpeg',
//         size: 109886
//     },
//     timestamp: '2021-07-14T07:14:03.780Z'
// }).then(r => {
//     console.log(r)
// })
module.exports = {
    prepareSendMessage, createContact
}
