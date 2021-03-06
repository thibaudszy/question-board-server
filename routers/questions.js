const { Router } = require('express');
const { Op } = require('sequelize');
const authMiddleware = require('../auth/middleware');
const { cloudinary } = require('../config/cloudinary');
const User = require('../models').user;
const Question = require('../models').question;
const Comment = require('../models').comment;
const Tag = require('../models').tag;
const QuestionTag = require('../models').questionTag;

const router = new Router();

router.get('/', async (req, res, next) => {
  try {
    const allQuestions = await Question.findAll();
    res.send(allQuestions);
  } catch (error) {
    next(e);
  }
});

router.get('/unresolved', async (req, res, next) => {
  try {
    const allQuestions = await Question.findAll({
      where: { resolved: false },
      include: [
        {
          model: User,
          as: 'author',
          attributes: ['id', 'firstName', 'lastName', 'classNo'],
        },
        {
          model: User,
          as: 'solver',
          attributes: ['id', 'firstName', 'lastName', 'classNo'],
        },
      ],
    });
    res.send(allQuestions);
  } catch (error) {
    next(error);
  }
});
router.get('/queue', async (req, res, next) => {
  try {
    const allQuestions = await Question.findAll({
      where: { resolved: false, solverId: null },
      include: {
        model: User,
        as: 'author',
        attributes: ['id', 'firstName', 'lastName', 'classNo'],
      },
    });
    res.send(allQuestions);
  } catch (error) {
    next(error);
  }
});

//  Route to find a question by id with comments
router.get('/:id', async (req, res, next) => {
  const { id } = req.params;

  try {
    const question = await Question.findOne({
      where: { id },
      include: [
        {
          model: User,
          as: 'author',
          attributes: ['id', 'firstName', 'lastName', 'classNo'],
        },
        { model: Comment, include: [{ model: User, as: 'author' }] },
        { model: Tag, attributes: ['id', 'tagname', 'createdAt'] },
      ],
    });

    if (!question) {
      res.status(400).send({ message: 'Something went wrong, question not found' });
      return;
    }

    res.status(200).json(question);
  } catch (e) {
    next(e);
  }
});

// Route icrements question upvotes
router.put('/upvote/:id', async (req, res, next) => {
  const { id } = req.params;

  try {
    const questionToUpdate = await Question.findByPk(id);
    if (questionToUpdate) {
      try {
        const updatedQuestion = await questionToUpdate.update({
          ...questionToUpdate,
          upVotes: (questionToUpdate.upVotes += 1),
        });

        res.json(updatedQuestion);
      } catch (e) {
        next(e);
      }
    }
  } catch (e) {
    next(e);
  }
});

router.put('/:questionid/comments/:commentid/upvotes', async (req, res, next) => {
  const { questionid, commentid } = req.params;

  try {
    const commentToUpdate = await Comment.findByPk(commentid);

    if (commentToUpdate) {
      try {
        const updatedComment = await commentToUpdate.update({
          ...commentToUpdate,
          upVotes: (commentToUpdate.upVotes += 1),
        });

        if (updatedComment) {
          return res.status(200).json(updatedComment);
        }
      } catch (e) {
        next(e);
      }
    }
  } catch (e) {
    next(e);
  }
});

router.put('/:questionid/comments/:commentid/', authMiddleware, async (req, res, next) => {
  const { questionid, commentid } = req.params;
  const { key, newValue } = req.body;

  try {
    const commentToUpdate = await Comment.findByPk(commentid);
    if (commentToUpdate) {
      try {
        const updatedComment = await commentToUpdate.update({
          ...commentToUpdate,
          [key]: newValue,
        });

        res.json(updatedComment);
      } catch (e) {
        next(e);
      }
    }
  } catch (e) {
    next(e);
  }
});

router.put('/:id', authMiddleware, async (req, res, next) => {
  const { id } = req.params;
  const { key, newValue } = req.body;

  try {
    const questionToUpdate = await Question.findByPk(id);
    if (questionToUpdate) {
      try {
        const updatedQuestion = await questionToUpdate.update({
          ...questionToUpdate,
          [key]: newValue,
        });

        res.json(updatedQuestion);
      } catch (e) {
        next(e);
      }
    }
  } catch (e) {
    next(e);
  }
});
router.post('/', authMiddleware, async (req, res, next) => {
  try {
    const authorId = req.user.id;
    const { image, title, questionBoardId, body, tags } = req.body;
    let screenshotURL;
    if (image) {
      const uploadedResponse = await cloudinary.uploader.upload(image, {
        upload_preset: 'ml_default',
      });
      screenshotURL = uploadedResponse.url;
    }

    const newQuestion = await Question.create({
      authorId,
      title,
      questionBoardId,
      body,
      screenshotURL,
      resolved: false,
      upVotes: 0,
      solverId: null,
    });

    const whereClause = tags.map((tag) => {
      return { tagname: tag };
    });
    const allTags = await Tag.findAll({
      where: {
        [Op.or]: [...whereClause],
      },
    });

    tags.forEach(async (tag) => {
      const tagExist = allTags.find((tagfromArray) => tagfromArray.tagname === tag);
      if (tagExist) {
        const newQuestionTag = await QuestionTag.create({
          questionId: newQuestion.id,
          tagId: tagExist.id,
        });
      } else {
        const newTag = await Tag.create({
          tagname: tag,
        });
        const newQuestionTag = await QuestionTag.create({
          questionId: newQuestion.id,
          tagId: newTag.id,
        });
      }
    });

    res.send(newQuestion);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
