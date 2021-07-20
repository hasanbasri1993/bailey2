const mysql = require('mysql')

function getActiveInstance(callback) {
    const connection = mysql.createConnection("MYSQL://root:hjve6uly@localhost/wa2api")
    connection.connect();
    return connection.query('SELECT * FROM instance WHERE status = "1"', function (err, rows) {
        if (err) throw err
        instanceData = []
        for (let n = 0; n < rows.length; n++)
            instanceData.push(rows[n])
        connection.end()
        return callback(rows);
    })
}

function getInstance(callback) {
    const connection = mysql.createConnection("MYSQL://root:hjve6uly@localhost/wa2api")
    connection.connect();
    return connection.query('SELECT * FROM instance', function (err, rows) {
        if (err) throw err
        instanceData = []
        for (let n = 0; n < rows.length; n++)
            instanceData.push(rows[n])
        connection.end()
        return callback(rows);
    })
}

function checkInstance(phone, callback) {
    const connection = mysql.createConnection("MYSQL://root:hjve6uly@localhost/wa2api")
    connection.connect();
    return connection.query(`SELECT phone FROM instance WHERE phone = "${phone}"`, function (err, rows) {
        if (err) throw err
        connection.end()
        return callback(rows.length);
    })
}

function toggleInstance(instanceId, callback) {
    const connection = mysql.createConnection("MYSQL://root:hjve6uly@localhost/wa2api")
    connection.connect();
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

function createNewInstance(data, callback) {
    data = [data]
    const connection = mysql.createConnection("MYSQL://root:hjve6uly@localhost/wa2api")
    connection.connect();
    connection.query(`SELECT phone FROM instance WHERE phone = "${data.phone}"`, function (err, rows) {
        if (err) throw err
        console.log(rows)
        if (!rows.length > 0)
            return connection.query(`INSERT INTO instance (name, phone, webhook) VALUES("${data.name}", ${data.phone}, "${data.webhook}")`, function (err, rows) {
                if (err) throw err
                connection.end()
                return callback(rows);
            })
        else {
            connection.end()
            return callback(false);
        }
    })
}

function updateInstance(data, callback) {
    const connection = mysql.createConnection("MYSQL://root:hjve6uly@localhost/wa2api")
    connection.connect();
    let setData = ""
    for (const obj in data) {
        if (data.hasOwnProperty(obj)) {
            for (const prop in data[obj]) {
                if (data[obj].hasOwnProperty(prop)) {
                    if (prop !== 'id')
                        setData += `${prop} = "${data[obj][prop]}", `
                }
            }
        }
    }
    console.log(`UPDATE instance SET ${setData.slice(0, -2)} WHERE id = ${data[0].id}`)
    return connection.query(`UPDATE instance SET ${setData.slice(0, -2)} WHERE id = ${data[0].id}`, function
    (err, rows, filed) {
        connection.end()
        return callback(rows.affectedRows === 1);
    })
}

// let data = [{id: 1018, phone: 628221358343219, name: "asdasdHasaasdasn Basri", webhook: "https:/asdasdasd"}]
// updateInstance(data, function (result) {
//     console.log(result)
// })


module.exports =
    {
        getActiveInstance,
        toggleInstance,
        getInstance,
        createNewInstance,
        updateInstance
    };


