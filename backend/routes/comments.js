const express = require('express');
const commentsRouter = express.Router({mergeParams: true});
const User = require('../models/userModel');
const Post = require('../models/postModel');
const Gig = require('../models/gigModel');
const Comment = require('../models/commentModel');
const bodyParser = require('body-parser');
const jsonParser = bodyParser.json();
const auth = require('./auth');

commentsRouter.use('/:commentId/reply', commentsRouter);

const parents = {
  'commentId': Comment,
  'postId': Post,
  'gigId': Gig
}

// a helper function
const findParent = (parents, parameters) => {
  for (let p in parents) {
    if (p in parameters) return p;
  }
}
// ---
commentsRouter.get('/', async (req, res) => {
  try {

    const p = findParent(parents, req.params);
    const parent = await parents[p].findById(req.params[p])
    if (!parent) {
      res.status(404).send('Cannot be found');
      return;
    }

    res.json(parent.comments);

  } catch (error) {
    res.json({ message: error });
  }
});
commentsRouter.get('/:id', async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id)
    if (!comment)
    {
      res.status(404).send('Cannot be found');
      return;
    }
    res.json(comment);

  } catch (error) {
    res.json({ message: error });
  }
});

commentsRouter.post('/', auth, async (req, res) => {
  try {

    const p = findParent(parents, req.params);
    const parent = await parents[p].findById(req.params[p])
    if (!parent) {
      res.status(404).send('Cannot be found');
      return;
    }
    const user = await User.findById(req.user._id);

    if (p == 'gigId' && !req.params.commentId && parent.createdBy != req.user._id && !parent.acceptedApplicants.includes(req.user._id))
    {
      res.status(404).send("you must be the creator or an accepted applicant to review the gig!");
      return;
    }
    if ('clubId' in req.params && !user.userClubs.createdClubs.includes(req.params.clubId) && !user.userClubs.joinedClubs.includes(req.params.clubId))
    {
      res.status(404).send('Permission Denied');
      return;
    }
    const comment = new Comment({...req.body, createdBy: req.user._id, createdIn: parent._id});
    const savedPost = await comment.save();

    let updatedUser = await User.updateOne(
      { _id: comment.createdBy},
      {$push: {'comments': comment._id}}
    );
    let updatedParent = await parents[p].updateOne(
      { _id: comment.createdIn},
      {$push: {'comments': comment._id}}
    );
    res.json(parent.comments);

  } catch (error) {
    res.json({ message: error });
  }
});

commentsRouter.patch('/:id', auth, async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id)
    if (!comment)
    {
      res.status(404).send('Cannot be found');
      return;
    }
    if (comment.createdBy != req.user._id) {
      return res.send("you can't edit the comment because it's not yours");
    }
    const updatedComment = await Comment.updateOne(
      { _id: req.params.id },
      { $set: {...req.body}}
    );
    res.json(comment);

  } catch (error) {
    res.json({ message: error });
  }
});

commentsRouter.delete('/:id', async (req, res) => {
  try {
    const p = findParent(parents, req.params);
    const parent = await parents[p].findById(req.params[p])
    if (!parent) {
      res.status(404).send('Cannot be found');
      return;
    }
    const comment = await Comment.findById(req.params.id);
    if (!comment) {
      res.status(404).send('Cannot be found');
      return;
    }
    const user = await User.findById(req.user._id);

    if (p != 'gigId' && comment.createdBy != req.user._id && (('clubId' in req.params && !user.userClubs.createdClubs.includes(req.params.clubId)) || ('eventId' in req.params && !user.userEvents.createdEvents.includes(req.params.eventId)))) {
      return res.send("you can't remove the comment because it's not yours");
    }
    if (p == 'gigId' && comment.createdBy != req.user._id) {
      return res.send("you can't remove the comment because it's not yours");
    }
    let updatedUser = await User.updateOne(
      { _id: comment.createdBy},
      {$pull: {'comments': comment._id}}
    );
    let updatedParent = await parents[p].updateOne(
      { _id: comment.createdIn},
      {$pull: {'comments': comment._id}}
    );
    const removedComment = await Comment.remove({ _id: req.params.id });
    res.json(removedPost);
  } catch (error) {
    res.json({ message: error });
  }
});


module.exports = commentsRouter;
