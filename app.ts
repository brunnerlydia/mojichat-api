import * as Promise from 'bluebird';
import * as r from 'rethinkdb';
import db = require('./middleware/db');
const app = require('express')();
const server = require('http').Server(app);
const io = require('socket.io')(server);
import config = require('./config');
import * as users from './routes/users';
import * as debug from 'debug';
app.set('x-powered-by', false);
app.use(db.connect);
app.use('/users', users);
app.use(db.disconnect);


r.connect({ host: config.DB_HOST, db: config.DB_NAME, port: config.DB_PORT })
    .then((conn) => {

        r.table("users").indexWait('createdAt').run(conn).then(() => {
            startServer();
        })
            .error(() => {
                r.dbCreate(config.DB_NAME).run(conn)
                    .finally(() => {
                        return r.tableCreate("files").run(conn);
                    })
                    .finally(() => {
                        return r.tableCreate("users").run(conn);
                    }).finally(() => {
                        r.table("users").indexCreate("createdAt").run(conn);
                    }).finally(() => {
                        r.table("users").indexWait("createdAt").run(conn)
                    })
                    .then((result) => {
                        startServer();
                        conn.close();
                    }).error((err) => {
                        if (err) {
                            console.log(err)
                            process.exit(1)
                        }
                        startServer();
                        conn.close();
                    })
            })

    }
    , (err) => {
        throw err;
    })


function startServer() {
    server.listen(config.SERVER_PORT);
    console.log('starting server on port ' + config.SERVER_PORT);
}
