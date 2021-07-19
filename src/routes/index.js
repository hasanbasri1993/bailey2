const express = require('express');
const bodyParser = require("body-parser");
const {MessageType} = require("@adiwajshing/baileys");
const mime = require("mime-types");
const {getFilename} = require("../service/whatsapp");
const {placeSendMessageFileOrder} = require("../service/worker");
const {checkIsOnWhatsApp} = require("../service/whatsapp");
const {placeSendMessageOrder} = require("../service/worker");
const {BODY_CHECK} = require("../service/whatsapp");

const router = express.Router();

router.use(bodyParser.json({type: 'application/*+json'}))

/* GET home page. */
router.get('/', function (req, res) {
    res.render('index', {title: 'Express'});
});

/* GET home page. */
router.get('/readInstance', function (req, res) {
    if (conn) {
        let isConnected = conn.phoneConnected;
        let version = conn.version
        let browserDescription = conn.browserDescription
        res.send(
            {
                status: isConnected,
                version: version,
                browserDescription: browserDescription,
            });
    } else {
        res.send(
            {status: false, err: "Your company is not set yet"});
    }
});


/* POST sendMessage. */
router.post('/sendMessage', async function (req, res) {
    BODY_CHECK(req.body).then(async function (processData) {
        if (processData.status) {
            let order = {
                "chatId": processData.chatId,
                'body': req.body['body'],
                "type": MessageType.text,
            }
            if (req.body['delay']) order["delay"] = req.body['delay']
            let check = await checkIsOnWhatsApp(processData.chatId);
            if (check !== undefined) {
                placeSendMessageOrder(order)
                    .then((job) =>
                        res.send({
                            done: true,
                            queue_id: job.id,
                            message: "Your order will be ready in a while send to: " + processData.chatId
                        }))
                    .catch(() => res.send({
                        done: false,
                        message: "Your order could not be placed"
                    }))
            } else
                res.send({
                    done: false,
                    message: "wrong chatid, phone, groupid: " + processData.chatId
                })
        } else {
            res.send({
                status: false,
                err: "It is mandatory to inform the parameter ('chatId' required @c.us, @g.us) or 'phone'"
            });
        }
    });


});

/* POST sendFile. */
router.post('/sendFile', async function (req, res) {
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
                        res.send({
                            done: true,
                            queue_id: job.id,
                            message: "Your order will be ready in a while"
                        }))
                    .catch(() => res.send({
                        done: false,
                        message: "Your order could not be placed"
                    }));
            } else
                res.send({
                    done: false,
                    message: "wrong chatid, phone, groupid: " + processData.chatId
                })
        } else {
            res.send({
                status: false,
                err: "It is mandatory to inform the parameter ('chatId' required @c.us, @g.us) or 'phone'"
            });
        }
    })


});

module.exports = router;
