FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache python3 py3-pip && \
    pip install pymysql boto3 redis python-dotenv --break-system-packages

COPY package*.json ./

RUN npm install

COPY . .

RUN npm run build

EXPOSE 3002

CMD ["npm", "start"]
