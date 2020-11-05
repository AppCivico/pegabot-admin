FROM node:14.4.0

WORKDIR /home/node/app

COPY package.json package-lock.json* ./

RUN npm install && npm install pm2 -g && npm cache clean --force

COPY . .

CMD [ "pm2-runtime", "npm", "--", "start" ]



