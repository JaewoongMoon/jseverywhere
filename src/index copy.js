// index.js
// This is the main entry point of our application
const helmet = require('helmet');
const cors = require('cors');
const depthLimit = require('graphql-depth-limit');
const { createComplexityLimitRule } = require('graphql-validation-complexity');

const express = require('express');
const { ApolloServer } = require('apollo-server-express');
require('dotenv').config();
const jwt = require('jsonwebtoken');

// JWT 에서 사용자 정보 가져오기
const getUser = token => {
	if (token) {
		try {
			// 토큰에서 얻은 사용자 정보 반환
			return jwt.verify(token, process.env.JWT_SECRET);
		} catch (err) {
			throw new Error('Session invalid');
		}
	}
};

// 로컬 모듈 임포트
const db = require('./db');
const models = require('./models');
const typeDefs = require('./schema');
const resolvers = require('./resolvers');

// .env 파일에 명시된 포트 또는 포트 4000에서 서버를 실행
const port = process.env.PORT || 4000;
const DB_HOST = process.env.DB_HOST;

const app = express();
app.use(helmet());
app.use(cors());

db.connect(DB_HOST);

// 아폴로 서버 설정
const server = new ApolloServer({
	typeDefs,
	resolvers,
    validationRules: [depthLimit(5), createComplexityLimitRule(1000)],
	context: ({ req }) => {
		// 헤더에서 사용자 토큰 가져오기
		const token = req.headers.authorization;
		// 토큰에서 사용자 얻기
		const user = getUser(token);
		// 콘솔에 user 로깅
		console.log(user);
		// context에 db models 및 user 추가
		return { models, user };
	}
});

// 아폴로 그래프QL 미들웨어를 적용하고 경로를 /api로 설정
server.applyMiddleware({ app, path: '/api' });

app.listen({ port }, () =>
	console.log(
		'GraphQL Server running at http://localhost:${port}${server.graphqlPath}'
	)
);
