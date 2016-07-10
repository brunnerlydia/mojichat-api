import config = require("../config");
import * as jwt from 'jsonwebtoken';
import * as r from 'rethinkdb';
export = {
    verify(req, res, next) {
        if (req.body && req.body.access_token) {
            jwt.verify(req.body.access_token, config.SECRET, (err, decoded) => {
                if (err && err.message === 'jwt expired') {
                    res.status(400).end('Token expired');
                } else if (err) {
                    res.status(401).end('Unauthorized');
                } else if (decoded) {

                    r.table("users").get(decoded.iss).run(req.conn)
                        .then((result) => {
                            if (!result) {
                                res.status(404).end('User does not exist.');
                            } else {
                                req.userId = decoded.iss;
                                req.isAdmin = decoded.isAdmin;
                                next();
                            }
                        })
                        .error((err) => {
                            console.log(err)
                            res.status(500).end('Internal server error');
                        })

                }
            })
        } else if (req.headers['access_token']) {
            jwt.verify(req.headers['access_token'], config.SECRET, (err, decoded) => {
                if (err && err.message === 'jwt expired') {
                    res.status(400).end('Token expired');
                } else if (err) {
                    res.status(401).end('Unauthorized');
                } else if (decoded) {

                    r.table("users").get(decoded.iss).run(req.conn)
                        .then((result) => {
                            if (!result) {
                                res.status(404).end('User does not exist.');
                            } else {
                                req.userId = decoded.iss;
                                req.isAdmin = decoded.isAdmin;
                                next();
                            }
                        })
                        .error((err) => {
                            console.log(err)
                            res.status(500).end('Internal server error');
                        })

                }
            })
        } else {
            res.status(500).end('User token missing.');
        }
    }
}