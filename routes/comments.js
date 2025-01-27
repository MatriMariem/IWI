const express = require('express');
const commentsRouter = express.Router({mergeParams: true});
const User = require('../models/userModel');
const Post = require('../models/postModel');
const Gig = require('../models/gigModel');
const Comment = require('../models/commentModel');
const bodyParser = require('body-parser');
const jsonParser = bodyParser.json();
const auth = require('./auth');

const ObjectId = require('mongoose').Types.ObjectId;

commentsRouter.use('/:commentId/reply', commentsRouter);

// Potential parents of a comment: a comment can be writted on a post
// or on a gig (as a review)
// or on another comment (as a reply to that comment)
const parents = {
  'commentId': Comment,
  'postId': Post,
  'gigId': Gig
}

// a helper function to find the parent of the comment
const findParent = (parents, parameters) => {
  for (let p in parents) {
    if (p in parameters) return p;
  }
}
// ---
// GET ALL COMMENTS OF THAT PARENT
commentsRouter.get('/', async (req, res) => {
  try {

    const p = findParent(parents, req.params);

    if (!ObjectId.isValid(req.params[p])) {
      return res.status(404).send('Cannot be found');
    }
    const parent = await parents[p].findById(req.params[p])
    if (!parent) {
      res.status(404).send('Cannot be found');
      return;
    }

    res.json(parent.comments);

  } catch (error) {
    res.status(500).json({ message: error });
  }
});

// GET A SPECIFIC COMMENT
commentsRouter.get('/:id', async (req, res) => {
  try {

    if (!ObjectId.isValid(req.params.id)) {
      return res.status(404).send('Cannot be found');
    }
    const comment = await Comment.findById(req.params.id)
    if (!comment)
    {
      res.status(404).send('Cannot be found');
      return;
    }
    res.json(comment);

  } catch (error) {
    res.status(500).json({ message: error });
  }
});

// CREATE A NEW COMMENT
commentsRouter.post('/', auth, async (req, res) => {
  try {

    const p = findParent(parents, req.params);

    if (!ObjectId.isValid(req.params[p])) {
      return res.status(404).send('Cannot be found');
    }
    const parent = await parents[p].findById(req.params[p])
    if (!parent) {
      res.status(404).send('Cannot be found');
      return;
    }

    if (!ObjectId.isValid(req.user._id)) {
      return res.status(404).send('Cannot be found');
    }
    const user = await User.findById(req.user._id);

    if (p == 'gigId' && !req.params.commentId && parent.createdBy != req.user._id && !parent.acceptedApplicants.includes(req.user._id))
    {
      res.status(403).send("you must be the creator or an accepted applicant to review the gig!");
      return;
    }
    if ('clubId' in req.params && !user.userClubs.createdClubs.includes(req.params.clubId) && !user.userClubs.joinedClubs.includes(req.params.clubId))
    {
      res.status(403).send('Permission Denied');
      return;
    }
    const comment = new Comment({...req.body, createdBy: req.user._id, createdIn: parent._id});
    const savedPost = await comment.save();

    // Send a notification to the user that you commented to
    // if you commented on a post, then the post owner will be notified
    // if you replied to a comment, then the comment owner will be notified
    const parentOwner = await User.findById(parent.createdBy)
    if ('commentId' in req.params) { const action = 'CommentReply'} else { const action = 'PostComment'}
    const notif = {
      action: action,
      links: [{content: user.username, id: req.user._id}, {content: comment.content, id: comment._id}, {content: parent.content, id: parent._id}],
      from: req.user._id,
      to: parentOwner._id,
    }

    let updatedUser = await User.updateOne(
      { _id: comment.createdBy},
      {$push: {'comments': comment._id}}
    );
    let updatedParent = await parents[p].updateOne(
      { _id: comment.createdIn},
      {$push: {'comments': comment._id}}
    );

    updatedUser = await User.updateOne(
      { _id: parent.createdBy},
      {$push: {'notifications': notif}}
    );

    res.json(parent.comments);

  } catch (error) {
    res.status(500).json({ message: error });
  }
});

// EDIT YOUR COMMENT
commentsRouter.patch('/:id', auth, async (req, res) => {
  try {

    if (!ObjectId.isValid(req.params.id)) {
      return res.status(404).send('Cannot be found');
    }
    const comment = await Comment.findById(req.params.id)
    if (!comment)
    {
      res.status(404).send('Cannot be found');
      return;
    }

    if (comment.createdBy != req.user._id) {
      return res.status(403).send("you can't edit the comment because it's not yours");
    }

    const p = findParent(parents, req.params);

    if (!ObjectId.isValid(req.params[p])) {
      return res.status(404).send('Cannot be found');
    }
    const parent = await parents[p].findById(req.params[p])
    if (!parent) {
      res.status(404).send('Cannot be found');
      return;
    }

    // Send a notification to the user that you commented to
    // if you commented on a post, then the post owner will be notified
    // if you replied to a comment, then the comment owner will be notified
    if (!ObjectId.isValid(req.user._id)) {
      return res.status(404).send('Cannot be found');
    }
    const user = await User.findById(req.user._id);
    const parentOwner = await User.findById(parent.createdBy);

    if ('commentId' in req.params) { const action = 'CommentReplyEdit'} else { const action = 'PostCommentEdit'}
    const notif = {
      action: action,
      links: [{content: user.username, id: req.user._id}, {content: comment.content, id: comment._id}, {content: parent.content, id: parent._id}],
      from: req.user._id,
      to: parentOwner._id,
    }
    const updatedComment = await Comment.updateOne(
      { _id: req.params.id },
      { $set: {...req.body}}
    );
    const updatedUser = await User.updateOne(
      { _id: parent.createdBy},
      {$push: {'notifications': notif}}
    );
    res.json(comment);

  } catch (error) {
    res.status(500).json({ message: error });
  }
});

// DELETE A COMMENT
commentsRouter.delete('/:id', auth, async (req, res) => {
  try {
    const p = findParent(parents, req.params);

    if (!ObjectId.isValid(req.params[p])) {
      return res.status(404).send('Cannot be found');
    }
    const parent = await parents[p].findById(req.params[p])
    if (!parent) {
      res.status(404).send('Cannot be found');
      return;
    }

    if (!ObjectId.isValid(req.params.id)) {
      return res.status(404).send('Cannot be found');
    }
    const comment = await Comment.findById(req.params.id);
    if (!comment) {
      res.status(404).send('Cannot be found');
      return;
    }

    if (!ObjectId.isValid(req.user._id)) {
      return res.status(404).send('Cannot be found');
    }
    const user = await User.findById(req.user._id);
    // In order to delete a comment, you should be either the owner of the comment
    // or the owner of the club/event in which the comment was written
    if (p != 'gigId' && comment.createdBy != req.user._id && (('clubId' in req.params && !user.userClubs.createdClubs.includes(req.params.clubId)) || ('eventId' in req.params && !user.userEvents.createdEvents.includes(req.params.eventId)))) {
      return res.status(403).send("you can't remove the comment because it's not yours");
    }
    if (p == 'gigId' && comment.createdBy != req.user._id) {
      return res.status(403).send("you can't remove the comment because it's not yours");
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
    res.status(500).json({ message: error });
  }
});


module.exports = commentsRouter;
