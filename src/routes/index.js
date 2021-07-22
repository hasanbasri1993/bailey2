const express = require('express');
const bodyParser = require("body-parser");

const fs = require('fs');
const {MessageType} = require("@adiwajshing/baileys");
const mime = require("mime-types");
const timeout = require("connect-timeout");
const {mkZap} = require("../service/whatsapp");
const {createNewInstance} = require("../service/db");
const {getInstance} = require("../service/db");
const {toggleInstance} = require("../service/db");
const {getFilename} = require("../service/whatsapp");
const {placeSendMessageFileOrder} = require("../service/worker");
const {checkIsOnWhatsApp} = require("../service/whatsapp");
const {placeSendMessageOrder} = require("../service/worker");
const {BODY_CHECK} = require("../service/whatsapp");

const router = express.Router();

router.use(bodyParser.json({type: 'application/*+json'}))

/* GET home page. */
router.get('/', function (req, res) {
    getInstance(async function (result) {
        instanceData = []
        for (let n = 0; n < result.length; n++) {
            instanceData.push(result[n])
        }
        res.render('index', {title: 'Express', data: instanceData});
    });


});


/* GET home page. */
router.get('/:instance/readInstance', async function (req, res) {
    let index = connswa.findIndex(x => x.name === parseInt(req.params['instance']))
    if (index > -1) {
        const zapance = await connswa[index].session
        if (zapance) {
            let isConnected = zapance.phoneConnected;
            let version = zapance.version
            let browserDescription = zapance.browserDescription
            res.json(
                {
                    status: isConnected,
                    version: version,
                    browserDescription: browserDescription,
                });
        }
    }
})


/* GET home page. */
router.get('/:instance/toggle/:status', async function (req, res) {
    let index = connswa.findIndex(x => x.name === parseInt(req.params['instance']))
    let indexIns = instanceData.findIndex(x => x.id === parseInt(req.params['instance']))
    toggleInstance(parseInt(req.params.instance), function (r) {
        console.log(r)
    })

    console.log("instanceData[indexIns]")
    console.log(instanceData[indexIns])
    if (req.params.status === "0") {
        if (instanceData[indexIns].session === null)
            await mkZap(false, instanceData[indexIns])
        else {
            let buff = Buffer.from(instanceData[indexIns].session, 'base64');
            fs.writeFileSync(`./${instanceData[indexIns].id}.json`, buff) // save this info to a file
            let session = await mkZap(`./${instanceData[indexIns].id}.json`, instanceData[indexIns])
            connswa.push({name: req.params['instance'], session})
        }
    } else {
        const zapance = await connswa[index].session
        zapance.close()
        connswa.splice(index, 1)
        instanceData.splice(indexIns, 1)
    }
    console.log(connswa)
    res.redirect('/')

})

/* GET home page. */
router.get('/add', async function (req, res) {
    res.render('add_instance', {title: 'Express', data: instanceData})
})


/* GET home page. */
router.post('/add_instance', async function (req, res) {
    let body = req.body;
    let data = {phone: body.phone, name: body.name, webhook: body.webhook}
    createNewInstance(data, function (result) {
        console.log(result)
        if (!result)
            res.render('add_instance', {title: 'Phone sudah sipakei', data: instanceData})
        else
            res.redirect('/')
    })

})


/* POST sendMessage. */
router.post('/:instance/sendMessage', async function (req, res) {

    let index = connswa.findIndex(x => x.name === parseInt(req.params['instance']))
    if (index > -1) {
        BODY_CHECK(req.body).then(async function (processData) {
            if (processData.status) {
                let order = {
                    "instance": index,
                    "chatId": processData.chatId,
                    'body': req.body['body'],
                    "type": MessageType.text,
                }
                if (req.body['delay']) order["delay"] = req.body['delay']
                let check = await checkIsOnWhatsApp(processData.chatId);
                if (check !== undefined) {
                    placeSendMessageOrder(order)
                        .then((job) =>
                            res.json({
                                done: true,
                                queue_id: job.id,
                                message: "Your order will be ready in a while send to: " + processData.chatId
                            }))
                        .catch(() => res.json({
                            done: false,
                            message: "Your order could not be placed"
                        }))
                } else
                    res.json({
                        done: false,
                        message: "wrong chatid, phone, groupid: " + processData.chatId
                    })
            } else {
                res.json({
                    status: false,
                    err: "It is mandatory to inform the parameter ('chatId' required @c.us, @g.us) or 'phone'"
                });
            }
        });

    } else
        res.send({
            msg: req.params['instance'] + index
        })


});

/* POST sendFile. */
router.post('/:instance/sendFile', async function (req, res) {

    let index = connswa.findIndex(x => x.name === parseInt(req.params['instance']))
    if (index > -1) {
        BODY_CHECK(req.body).then(async function (processData) {
            if (processData.status) {
                let url_file = req.body['body'];
                let mediaType;
                switch (mime.lookup(getFilename(url_file))) {
                    case "image/png":
                    case "image/jpeg":
                        mediaType = mediaType = MessageType.image;
                        break;
                    case "video/mp4":
                    case "video/gif":
                        mediaType = mediaType = MessageType.video;
                        break;
                    case "application/pdf":
                        mediaType = mediaType = MessageType.document;
                        break;
                    case "audio/ogg":
                        mediaType = mediaType = MessageType.audio;
                        break;
                    case "image/webp":
                        mediaType = mediaType = MessageType.sticker;
                        break;
                    default:
                        mediaType = mediaType = MessageType.document;
                        break;

                }
                let order = {
                    "instance": index,
                    "mimetype": mime.lookup(getFilename(url_file)),
                    "type": mediaType,
                    "caption": req.body['caption'],
                    "filename": getFilename(url_file),
                    "chatId": processData.chatId,
                    'body': url_file,
                }
                if (req.body['delay']) order["delay"] = req.body['delay']
                let check = await checkIsOnWhatsApp(processData.chatId);
                if (check !== undefined) {
                    placeSendMessageFileOrder(order)
                        .then((job) =>
                            res.json({
                                done: true,
                                queue_id: job.id,
                                message: "Your order will be ready in a while"
                            }))
                        .catch(() => res.json({
                            done: false,
                            message: "Your order could not be placed"
                        }));
                } else
                    res.json({
                        done: false,
                        message: "wrong chatid, phone, groupid: " + processData.chatId
                    })
            } else {
                res.json({
                    status: false,
                    err: "It is mandatory to inform the parameter ('chatId' required @c.us, @g.us) or 'phone'"
                });
            }
        })

    } else
        res.send({
            msg: req.params['instance'] + index
        })


});


module.exports = router;
