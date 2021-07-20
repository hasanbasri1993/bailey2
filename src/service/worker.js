require('dotenv').config()
const Queue = require('bull');
const https = require("https");
const axios = require('axios');
const {prepareSendMessage, createContact} = require("./chatwoot");
const optionsProses = {
    timeout: 10000,
    attempts: 2,
    delay: 500,
}
const options = {
    rateLimited: {
        limiter: {
            max: 1,
            duration: 1000
        }
    },
    redis: {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        password: process.env.DB_PASS,
    },
}
const chatwootWorker = new Queue('chatwootWorker', options);
const sendWebhook = new Queue('sendWebhook', options);
const sendMessage = new Queue('sendMessage', options);
const sendMessageFile = new Queue('sendMessageFile', options);


const placeSendWebhookOrder = (data, webhook_url) => {
    let data1 = [data, webhook_url]
    return sendWebhook.add(data1, optionsProses)
};

const placeChatwootOrder = (jobData) => {
    return chatwootWorker.add(jobData, optionsProses)
};

const placeSendMessageOrder = (data) => {
    if (data["delay"]) {
        const optionsProses = {
            timeout: 10000,
            attempts: 2,
            delay: data["delay"] * 1000,
        }
        return sendMessage.add(data, optionsProses)
    }
    return sendMessage.add(data, optionsProses)
};

const placeSendMessageFileOrder = (data) => {
    if (data["delay"]) {
        const optionsProses = {
            timeout: 10000,
            attempts: 2,
            delay: data["delay"] * 1000,
        }
        return sendMessageFile.add(data, optionsProses)
    }
    return sendMessageFile.add(data, optionsProses)
};


chatwootWorker.process(job => {
    // if (job.data.order === "prepareSendMessage") {
    //     prepareSendMessage(job.data.number, job.data.content).then(r => {
    //         if (r != null) job.progress(100);
    //     })
    //
    // } else {
    //     createContact(job.data.number, job.data.name).then(r => {
    //         if (r != null) job.progress(100);
    //     })
    //     job.progress(100);
    // }
});

sendWebhook.process(job => {
    console.log(`🍳 Preparing sendWebhook`);
    axios.post(job.data[1], JSON.stringify(job.data[0]))
        .then(function (response) {
            job.progress(100);
            console.log(`🍳 Success ${response.status} sendWebhook jobId ${job.id}`)
        })
        .catch(function (error) {
            console.log(error);
        });
});

sendMessage.process(async job => {
    try {
        const zapance = await connswa[job.data.instance].session
        const sendMsg = zapance.sendMessage(job.data.chatId, job.data.body, job.data.type).then(function (processData) {
            console.log(`🍳 Success ${JSON.stringify(processData)}  sendMessage ${job.data.chatId} jobId ${job.id}`)
            console.log(sendMsg)
            job.progress(100);
        });
    } catch (e) {
        console.log(e)
    }
});

sendMessageFile.process(job => {
    const options = {
        mimetype: job.data.mimetype,
        caption: job.data.caption
    }
    getImage(job.data.body, async function (err, data) {
        console.log(`🍳 Preparing ${job.data.chatId} sendMessageFile`);
        const zapance = await connswa[job.data.instance].session
        const sendMsg = zapance.sendMessage(job.data.chatId, data, job.data.type, options).then(function (processData) {
            console.log(`🍳 Success ${JSON.stringify(processData)} sendMessageFile  ${job.data.chatId}`)
            console.log(sendMsg)
            job.progress(100);
        });
    });
});

function getImage(url, callback) {
    https.get(url, res => {
        const buffs = [];
        res.on('data', function (chunk) {
            buffs.push(chunk)
        });
        res.on('end', function () {
            const data = Buffer.concat(buffs);
            callback(null, data);
        });
    })
        .on('error', callback);
}

module.exports = {
    getImage,
    placeSendMessageOrder,
    placeSendMessageFileOrder,
    placeSendWebhookOrder,
    placeChatwootOrder
};
