import * as express from 'express';
import * as bodyParser from 'body-parser';
import * as bcrypt from 'bcrypt';
import * as r from 'rethinkdb';
import * as jwtoken from 'jsonwebtoken';
import * as crypto from 'crypto';
import * as moment from 'moment';
import * as nodemailer from 'nodemailer';
import * as fs from 'fs';
import * as multer from 'multer';
import * as gm from 'gm';
import * as mime from 'mime';
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, '/tmp/mojichat_uploads/')
    },
    filename: function (req, file, cb) {
        cb(null, file.fieldname + '-' + Date.now() + '.' + mime.extension(file.mimetype))
    }
})
var upload = multer({ storage: storage })
import userMW = require('../middleware/user');
import config = require("../config");
const router = express.Router();
const saltRounds = 12;
const transporter = nodemailer.createTransport(config.SMTP_OPTIONS)
router.use(bodyParser.urlencoded({ extended: false }));
//Create User
router.post('/', (req: any, res) => {
    if (req.body && req.body.email && req.body.password) {

        r.db(config.DB_NAME).table('users').filter({ email: req.body.email }).run(req.conn)
            .then((cursor) => {
                cursor.next((err, row) => {
                    if (err && err.message.indexOf('No more rows ') > -1) {
                        const salt = bcrypt.genSaltSync(saltRounds);
                        if (!salt) res.status(500).end('User registration failed try again later.');
                        const hash = bcrypt.hashSync(req.body.password, salt);
                        if (!hash) res.status(500).end('User registration failed try again later.');
                        const refresh_token = crypto.randomBytes(20).toString('hex');
                        if (!refresh_token) res.status(500).end('User registration failed try again later.');
                        r.table("users").insert({ isAdmin: false, email: req.body.email, password: hash, refresh_token: refresh_token }).run(req.conn)
                            .then((result) => {
                                const exp = moment().add(3, "months").valueOf();
                                const user = { userId: result.generated_keys[0], email: req.body.email, expires: exp, refresh_token: refresh_token, access_token: jwtoken.sign({ isAdmin: false }, config.SECRET, { issuer: result.generated_keys[0], expiresIn: exp }) };
                                res.set('Content-Type', 'application/json');
                                res.json(user);
                            }, (err) => {
                                console.log(err)
                                res.status(500).end('Internal server error');
                            })
                    } else if (row) {
                        res.end('An account already exists for this email address.');
                    }

                })
            },
            (err) => {
                console.log(err)
                res.status(500).end('Internal server error');
            })
    } else if (req.body && !req.body.email) {
        res.status(500).end('Email cannot be empty');
    } else if (req.body && !req.body.password) {
        res.status(500).end('Password cannot be empty');
    }
});
//Get Users
router.get('/', (req: any, res: express.Response) => { });
//Get User by Id
router.get('/:id', (req, res) => {
});
//Update User by Id
router.put('/:id', userMW.verify, (req, res) => {
    const user = {
        displayName: req.body.displayName || null
    };
    r.table("users").get(req.params["id"]).update(user).run(req.conn)
        .then((succ) => {
            res.end('User updated')
        })
        .error((err) => {
            console.log(err);
            res.status(500).end('Failed to update user.')
        })
});
//Delete User by Id
router.delete('/:id', (req, res) => { });
//Login
router.post('/login', (req: any, res) => {
    if (req.body.email && req.body.password) {
        r.table("users").filter({ email: req.body.email }).run(req.conn)
            .then((cursor) => {
                cursor.next((err, row) => {
                    if (err && err.message.indexOf('No more rows in the cursor') > -1) {
                        res.status(404).end('User does not exist.');
                    } else {
                        const valid = bcrypt.compareSync(req.body.password, row.password);
                        if (valid) {
                            const exp = moment().add(3, "months").valueOf();
                            const user = {
                                userId: row.id, email: row.email, expires: exp, refresh_token: row.refresh_token, access_token: jwtoken.sign({ isAdmin: row.isAdmin }, config.SECRET, { issuer: row.id, expiresIn: exp })
                            };
                            res.set('Content-Type', 'application/json');
                            res.json(user);
                        } else if (!valid) {
                            res.status(500).end('The password you entered is incorrect')
                        }

                    }
                })
            },
            (err) => {
                if (err.message.indexOf('does not exist in')) {
                    res.status(404).end('User does not exist.');
                } else {
                    console.log(err);
                    res.end()
                }
            })
    } else if (req.body && !req.body.email) {
        res.status(500).end('Email cannot be empty');
    } else if (req.body && !req.body.password) {
        res.status(500).end('Password cannot be empty');
    }
});
//Generate Reset password token
router.post('/forget', (req: any, res) => {  //Added reset page
    if (req.body.email) {
        r.table("users").filter({ email: req.body.email }).run(req.conn)
            .then((cursor) => {
                cursor.next((err, row) => {
                    if (err && err.message.indexOf('No more rows in the cursor') > -1) {
                        res.status(404).end('User does not exist.');
                    } else {
                        res.end("Email sent");
                        transporter.sendMail({
                            from: '"MojiChat" <noreply@fitcom.co>', // sender address
                            to: req.body.email, // list of receivers
                            subject: 'Reset your password', // Subject line
                            text: `Hello,
Follow this link to reset your MojiChat password for your ${req.body.email} account.
If you didn’t ask to reset your password, you can ignore this email.
Thanks,
MojiChat team`, // plaintext body
                            html: `
                            <p>Hello,</p>
<p>Follow this link to reset your MojiChat password for your ${req.body.email} account.</p>
<p>If you didn’t ask to reset your password, you can ignore this email.</p>
<p>Thanks,</p>
<p>MojiChat team</p>` // html body
                        })
                    }
                });
            })
            .error((err) => {
                if (err.message.indexOf('does not exist in')) {
                    res.status(404).end('User does not exist.');
                } else {
                    console.log(err);
                    res.end()
                }
            })
    } else if (!req.body.email) {
        res.status(500).end('Email cannot be empty');
    }
});
//Reset password using generated token
router.post('/reset/:token', (req, res) => {

});
router.post('/image/profile/:id', upload.single('avatar'), userMW.verify, (req, res) => {
    if ((req.userId === req.params['id']) && req.file) {
        gm(req.file.path).compress("JPEG").toBuffer((err, buf) => {
            r.table("users").get(req.params['id']).run(req.conn)
                .then((result: any) => {
                    if (result && result.avatar) {
                        r.table("files").get(result.avatar).delete().run(req.conn)
                            .then(() => {
                                return r.table("files").insert({ file: buf }).run(req.conn)
                            }).then((result) => {
                                return r.table("users").get(req.params['id']).update({ avatar: result.generated_keys[0] }).run(req.conn)
                            })
                            .then((result) => {
                                res.end("Upload successful")
                            })
                            .error((err) => {
                                res.status(500).end('Error occured while updating profile photo');
                            })
                    } else {
                        r.table("files").insert({ file: buf }).run(req.conn)
                            .then((result) => {
                                return r.table("users").get(req.params['id']).update({ avatar: result.generated_keys[0] }).run(req.conn)
                            })
                            .then((result) => {
                                res.end("Upload successful")
                            })
                            .error((err) => {
                                res.status(500).end('Failed to change profile photo')
                            })
                    }
                }).error((err) => {
                    console.log(err)
                    res.end('err')
                })
        })
    } else if (req.isAdmin && req.file) {
        gm(req.file.path).compress("JPEG").toBuffer((err, buf) => {
            r.table("files").insert({ file: buf }).run(req.conn)
                .then((result) => {
                    return r.table("users").get(req.params['id']).update({ avatar: result.generated_keys[0] }).run(req.conn)
                })
                .then((result) => {
                    res.end("Upload successful")
                })
                .error((err) => {
                    res.status(500).end('Failed to change profile photo')
                })
        })
    } else {
        res.status(401).end('Unauthorized');
    }
});

router.get('/avatar/:id', userMW.verify, (req, res) => {
    if (req.params["id"]) {
        r.table("files").get(req.params['id']).pluck("file").run(req.conn)
            .then((file) => {
                res.json(file);
            })
            .error((err) => {
                console.log(err)
                res.end()
            })
    }
});

export = router;