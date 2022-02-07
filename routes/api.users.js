const { Router } = require('express')
const jwt = require('jsonwebtoken')
const md5 = require('md5')
const multer = require('multer')
const { getUser, verifyAccessToken, pool } = require('../src/util')
const util = require('../src/util')
const { getFollowers, getFollowing, isFriend } = require('../src/utils/followers')

const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        cb(null, 'forest/assets/avatars')
    },
    filename: function(req, file, cb) {
        console.log(file)
        cb(null, Math.floor(Date.now()/1000).toString(16) + genRanHex(24) + getExtension(file.originalname)) // 8 + 24 = 32
    }
})

const fileFilter = (req, file, cb) => {
    if(file.mimetype === 'image/jpeg' || file.mimetype === 'image/png') {
        cb(null, true)
    } else {
        cb(JSON.stringify("Files can only be the type of jpeg or png"), false)
    }
}

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 1024 * 1024 * 5
    },
    fileFilter: fileFilter
})

module.exports.Router = class Routes extends Router {
    constructor() {
        super();

        // Root
        this.get('/', verifyAccessToken, (req, res) => {
            if(req.user.isAdmin) {
                req.mysql.query('SELECT * FROM users', (err, resu) => {
                    return res.json(resu)
                })
            } else {
                return res.send({"message": "404: Not found"});
            }
           
        })

        // GET @me - shows information about the user with token in Authorization
        this.get('/@me', verifyAccessToken, async (req, res) => {
            util.getUser(req.user.userId, (err, resu) => {
                const user = resu
                delete user.password, delete user.isVerified, delete user.isAdmin
                console.log(user)
                return res.json(user)
            })
            
        })

        // GET @me/avatar - returns the avatar of the user (if none, returns null)
        this.get('/@me/avatar', verifyAccessToken, async (req, res) => {
            getUser(req.user.userId, (err, resu) => {
                if(err) return res.status(500).send(err)
                if(resu.avatar) res.sendFile(`${process.cwd()}/forest/assets/avatars/${resu.avatar}`, (err) => {
                    if(err) return res.send({"message": "There is no avatar available with this name. Please reupload your avatar."})
                })
                else res.status(404).send({"message": "There is no avatar present"})
                
            })
        })

        // GET @me/followers - return an array of the followers of the user
        this.get('/@me/followers', verifyAccessToken, (req, res) => {
            getFollowers(req.user.userId, (err, resu) => {
                if(err) return res.status(500).send(err)
                res.send(resu)
            })
        })

        // GET @me/following - return an array of the followers of the user
        this.get('/@me/following', verifyAccessToken, (req, res) => {
            getFollowing(req.user.userId, (err, resu) => {
                if(err) return res.status(500).send(err)
                res.send(resu)
            })
        })

        // GET @me/friends/:id - return an boolean if user and ':id' follow each other (friends)
        this.get('/@me/friends/:id', verifyAccessToken, (req, res) => {
            isFriend(req.user.userId, req.params.id, (err, resu) => {
                if(err) return res.status(500).send(err)
                res.send(resu)
            })
        })

        // PATCH @me - edit user profile
        this.patch('/@me', verifyAccessToken, upload.single('avatar'), (req, res) => {
            if(!req.body.password) return res.status(401).send({"message": "Password required"})
            console.log(req.user.userId)
            getUser(req.user.userId, (err, resu) => {
                if(err) return res.status(500).send(err)
                if(md5(req.body.password) !== resu.password) return res.status(401).send({"message": "Wrong password"})
                if(req.file == undefined) req.file = null
                console.log(req.file);
                util.updateUser(req.user.userId, req.body.username, req.file == undefined ? null : req.file.filename, req.body.banner, req.body.banner_color, (myErr, myRes) => {
                    if(myErr) return res.status(500).send(myErr)
                    else res.sendStatus(200)
                })
            })
            
            
        })

        // GET :id - shows information about user with given id
        this.get('/:id', verifyAccessToken, async (req, res) => {
            getUser(req.params.id, (err, resu) => {
                if (err) console.error(err)
                delete resu.isAdmin
                delete resu.password
                delete resu.email
                delete resu.locale
                delete resu.isVerified
                return res.send(resu)
            })
        })

        // POST :id/follow - posts an follow request to given ':id'
        this.post('/:id/follow', verifyAccessToken, (req, res) => {
            if(req.user.userId === req.params.id) return res.status(403).send({"message": "You can't follow yourself."})
            try {
                const user = getUser('')
            } catch (err) {
                return res.status(500).send(err)
            }
        })
    }
};

function getExtension(filename) {
    var i = filename.lastIndexOf('.');
    return (i < 0) ? '' : filename.substr(i);
}

const genRanHex = size => [...Array(size)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');

module.exports.page = '/api/users';