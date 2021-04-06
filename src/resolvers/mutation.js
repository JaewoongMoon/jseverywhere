const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const {
	AuthenticationError,
	ForbiddenError
} = require('apollo-server-express');
require('dotenv').config();

const gravatar = require('../util/gravatar');
const { model } = require('../models/note');

module.exports = {
	// 사용자 context 추가
	newNote: async (parent, args, { models, user }) => {
		// context 에 user가 없으면 인증 에러 던지기
		if (!user) {
			throw new AuthenticationError(
				'You must be signed in to create a note'
			);
		}

		return await models.Note.create({
			content: args.content,
			author: mongoose.Types.ObjectId(user.id)
		});
	},
	deleteNote: async (parent, { id }, { models, user }) => {
		if (!user) {
			throw new AuthenticationError(
				'You must be signed in to delete a note'
			);
		}

		// note 찾기
		const note = await models.Note.findById(id);
		// note 소유자와 현재 사용자가 불일치하면 접근 에러 던지기
		console.log(note);
		if (note && String(note.author) !== user.id) {
			throw new ForbiddenError(
				"You don't have permissions to delete the note"
			);
		}

		try {
			// 문제가 없으면 note 삭제
			await note.remove();
			return true;
		} catch (err) {
			return false;
		}
	},
	updateNote: async (parent, { content, id }, { models, user }) => {
		if (!user) {
			throw new AuthenticationError(
				'You must be signed in to update a note'
			);
		}

		// note 찾기
		const note = await models.Note.findById(id);
		// note 소유자와 현재 사용자가 불일치하면 접근 에러 던지기
		console.log(note);
		if (note && String(note.author) !== user.id) {
			throw new ForbiddenError(
				"You don't have permissions to update the note"
			);
		}

		return await models.Note.findOneAndUpdate(
			{
				_id: id
			},
			{ $set: { content } },
			{ new: true }
		);
	},
	signUp: async (parent, { username, email, password }, { models }) => {
		// 이메일 주소 스트링 처리
		email = email.trim().toLowerCase();
		// 비밀번호 해싱
		const hashed = await bcrypt.hash(password, 10);
		// gravatar URL 생성
		const avatar = gravatar(email);
		try {
			const user = await models.User.create({
				username,
				email,
				avatar,
				password: hashed
			});

			// JWT 생성 및 반환
			return jwt.sign({ id: user._id }, process.env.JWT_SECRET);
		} catch (err) {
			console.log(err);
			throw new Error('Error creating account');
		}
	},
	signIn: async (parent, { username, email, password }, { models }) => {
		if (email) {
			email = email.trim().toLowerCase();
		}

		const user = await models.User.findOne({
			$or: [{ email }, { username }]
		});

		// 사용자를 찾지 못하면 인증 에러 던지기
		if (!user) {
			throw new AuthenticationError('Error signing in');
		}

		// 비밀번호가 불일치하면 인증 에러 던지기
		const valid = await bcrypt.compare(password, user.password);
		if (!valid) {
			throw new AuthenticationError('Error signing in');
		}

		// JWT 생성 및 반환
		return jwt.sign({ id: user._id }, process.env.JWT_SECRET);
	},
	toggleFavorite: async (parent, { id }, { models, user }) => {
		if (!user) {
			throw new AuthenticationError();
		}

		// 사용자가 노트를 이미 즐겨찾기했는지 확인
		let noteCheck = await models.Note.findById(id);
		const hasUser = noteCheck.favoritedBy.indexOf(user.id);

		// 사용자가 목록에 있으면
		// favoriteCount를 1줄이고 목록에서 사용자 제거
		if (hasUser >= 0) {
			return await models.Note.findByIdAndUpdate(
				id,
				{
					$pull: {
						favoritedBy: mongoose.Types.ObjectId(user.id)
					},
					$inc: {
						favoriteCount: -1
					}
				},
				{
					// new 를 true로 설정하여 없데이트된 doc 반환
					new: true
				}
			);
		} else {
			// 사용자가 목록에 없으면
			// favoriteCount를 1 늘리고 사용자를 목록에 추가
			return await models.Note.findByIdAndUpdate(
				id,
				{
					$push: {
						favoritedBy: mongoose.Types.ObjectId(user.id)
					},
					$inc: {
						favoriteCount: 1
					}
				},
				{
					new: true
				}
			);
		}
	}
};
