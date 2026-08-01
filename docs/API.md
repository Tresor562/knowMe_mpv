# API KnowMe

## Routes publiques

- `GET /health`
- `POST /auth/register`
- `POST /auth/login`
- `GET /posts/feed`

## Routes authentifiées

- `GET /users/me`
- `POST /posts`
- `POST /posts/:id/like`
- `POST /posts/:id/comments`
- `GET /challenges`
- `POST /challenges`
- `POST /challenges/:id/join`
- `GET /conversations`
- `POST /conversations`
- `POST /conversations/:id/messages`
- `GET /notifications`
- `PATCH /notifications/read-all`

## Routes administrateur

- `GET /admin/dashboard`
- `PATCH /admin/users/:id/suspension`
