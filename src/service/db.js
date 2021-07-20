const mysql = require('mysql')
const connection = mysql.createConnection("MYSQL://root:hjve6uly@localhost/wa2api")

function getActiveInstance(callback) {
    connection.connect()
    return connection.query('SELECT * FROM instance WHERE status = "1"', function (err, rows) {
        if (err) throw err
        connection.end()
        return callback(rows);
    })
}

function checkInstance(phone, callback) {
    return connection.query(`SELECT phone FROM instance WHERE phone = "${phone}"`, function (err, rows) {
        if (err) throw err
        connection.end()
        return callback(rows.length);
    })
}

function toggleInstance(instanceId, callback) {
    connection.query(`SELECT status FROM instance WHERE id = ${instanceId}`, function (err, rows, filed) {
        if (err) throw err
        if (!rows.length > 0) callback("not found that id instance")
        else {
            let newValue = rows[0].status === "0" ? 1 : 0
            return connection.query(`UPDATE instance SET status = "${newValue}" WHERE id = ${instanceId}`, function (err, rows, filed) {
                connection.end()
                return callback(rows.affectedRows === 1);
            })
        }
    })
}

module.exports =
    {getActiveInstance};


