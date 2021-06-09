const express = require('express');
const usersRouter = express.Router();
const bodyParser = require('body-parser');
const User = require('../models/userModel');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const auth = require('./auth');
const postsRouter = require('./posts');

const ObjectId = require('mongoose').Types.ObjectId;

usersRouter.use('/:userId/posts', postsRouter);

// use jwt-redis instead of jwt
const redis = require('redis');
const JWTR =  require('jwt-redis').default;
const redisClient = redis.createClient();
const jwtr = new JWTR(redisClient);

// GET ALL USERS
usersRouter.get('/', async (req, res) => {
  try {
    const users = await User.find();
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error, });
  }
});
// GET A SPECIFIC USER
usersRouter.get('/:id', async (req, res) => {
  try {
    // const user = await User.findById(req.params.id).populate({ path: 'posts', select: 'content createdAt', populate: {path: 'createdIn', select: 'title'}, populate: {path: 'comments', select: 'content createdAt', populate: {path: 'createdBy', select: 'username'}}}).populate({ path: 'userClubs.createdClubs', select: 'title' });
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(404).send('Cannot be found');
    }
    const user = await User.findById(req.params.id)
    if (!user) {
      return res.status(404).send('Cannot be found');
    }
    return res.send(user);
  } catch (error) {
    return res.status(500).json({ message: error, });
  }
});

// SIGNUP
usersRouter.post('/signup', async (req, res) => {
  try {
    // SIGNUP INPUT DATA VALIDATION
    let alreadyExist = await User.findOne({"email": req.body.email});
    if (alreadyExist) {
      return res.status(409).send({
        status: 'error',
        message: 'Email already used',
      });
    }
    alreadyExist = await User.findOne({"username": req.body.username});
    if (alreadyExist) {
      return res.status(409).send({
        status: 'error',
        message: 'Username already used',
      });
    }
    // hash password
    const salt = await bcrypt.genSalt(10);
    const hashpassword = await bcrypt.hash(req.body.password, salt);

    let userData = { ...req.body };
    userData.password = hashpassword;

    // create a new user
    const user = new User(userData);
    const savedUser = await user.save();
    // res.json(savedUser);
    res.status(201).send({
      status: 'success',
      message: "Account successfully created",
    });
  } catch (error) {
    res.status(500).send({
      status: 'error',
      message: error,
    });
  }
});

// LOGIN
usersRouter.post('/login', async (req, res) => {
  try {
    // LOGIN INPUT DATA VALIDATION
    // Check Email
    const user = await User.findOne({"email": req.body.email});
    console.log(`req`);
    console.log(req.body);
    if (!user) return res.send({ status: 'error', message: 'Email not found' });
    // Check Password
    const correctPassword = await bcrypt.compare(req.body.password, user.password);
    if (!correctPassword) return res.send({ status: 'error', message: "Wrong password" });
    jwtr.sign(
      {"_id": user._id},
      process.env.SECRET_TOKEN
    ).then((token) => {
      // console.log(token);
      res.header('auth-token', token);
      delete user.password;
      res.send({
        token: token,
        user: user,
      });
    }).catch((error) => {
      console.log(`error = ${error}`);
      res.send({ status: 'error', message: error });
    });
  } catch (error) {
  res.send({ status: 'error', message: error });
}});

// EDIT A USER
usersRouter.patch('/:id', auth, async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(404).send('Cannot be found');
    }
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).send('Cannot be found');

    if (req.user._id != user._id) return res.status(403).send("Access Denied");

    // You musn't edit the user id or password
    let userData = {...req.body};
    if (userData.id) delete userData.id;
    if (userData._id) delete userData._id;
    if (userData.password) delete userData.password;

    const updated = await User.updateOne(
      { _id: req.params.id },
      { $set: userData}
    );
    res.send(user);
  } catch (error) {
    res.status(500).json({ message: error });
  }
});

// RESET PASSWORD
usersRouter.patch('/:id/reset_password', auth, async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(404).send('Cannot be found');
    }
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).send("Cannot be found");

    if (req.user._id != user._id) return res.status(403).send("Access Denied");

    // Body must contain both of the old and new passwords
    if (!req.body.password) return res.status(400).send("Please enter the old password!");
    const correctPassword = await bcrypt.compare(req.body.password, user.password);
    if (!correctPassword) return res.status(403).send("wrong password");
    if (!req.body.new_password) return res.status(400).send("Please enter the new password!");

    // Hashing the new password and saving it
    const salt = await bcrypt.genSalt(10);
    const hashpassword = await bcrypt.hash(req.body.new_password, salt);

    const updated = await User.updateOne(
      { _id: req.params.id },
      { $set: {"password": hashpassword}}
    );
    res.send("user updated!");
  } catch (error) {
    res.status(500).json({ message: error });
  }
});

// DELETE A USER
usersRouter.delete('/:id', auth, async (req, res) => {
  try {

    if (!ObjectId.isValid(req.params.id)) {
      return res.status(404).send('Cannot be found');
    }
    const user = await User.findById(req.params.id);

    if (!user) return res.status(404).send("Cannot be found");

    if (req.user._id != user._id) return res.status(403).send("Access Denied");
    // The user must re-enter their password
    if (!req.body.password) return res.status(400).send("Please enter your password");

    const correctPassword = await bcrypt.compare(req.body.password, user.password);
    if (!correctPassword) return res.status(403).send("wrong password");

    const removedUser = await User.remove({ _id: req.params.id });
    res.json("Deleted");
  } catch (error) {
    res.status(500).json({ message: error });
  }
});

// LOGOUT
usersRouter.post('/logout', auth, async (req, res) => {
  console.log(req.headers);
  try {
    console.log(req.headers)
    const destroyed = await jwtr.destroy(req.user.jti);
    res.headers('auth-token', '');
    console.log("logged out!", destroyed);
    res.send({
      status: 'success',
      message: "logged out!"
    });
  } catch (error) {
    res.send({
      status: 'error',
      message: error,
    });
  }
});

module.exports = usersRouter;
