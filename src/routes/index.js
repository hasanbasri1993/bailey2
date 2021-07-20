const express = require('express');
const bodyParser = require("body-parser");

const {MessageType} = require("@adiwajshing/baileys");
const mime = require("mime-types");
const timeout = require("connect-timeout");
const {instance1} = require("../service/whatsapp");
const {getFilename} = require("../service/whatsapp");
const {placeSendMessageFileOrder} = require("../service/worker");
const {checkIsOnWhatsApp} = require("../service/whatsapp");
const {placeSendMessageOrder} = require("../service/worker");
const {BODY_CHECK} = require("../service/whatsapp");

const router = express.Router();

router.use(bodyParser.json({type: 'application/*+json'}))

/* GET home page. */
router.get('/', function (req, res) {
    console.log(instanceData)
    res.render('index', {title: 'Express', data: instanceData});
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
