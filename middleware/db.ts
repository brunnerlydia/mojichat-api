import config = require('../config');
import * as r from 'rethinkdb';
export = {
    connect(req: any, res: any, next: any) {
        const connection = r.connect({ host: config.DB_HOST, db: config.DB_NAME, port: config.DB_PORT });
        connection
            .then((conn) => {
                req.conn = conn;
                next();
            }, (err) => {
                res.status(500).end('Internal server error');
                throw err;
            })
    },
    disconnect(req: any, res: any, next: any) {
        req.conn.close();
        next();
    }
}