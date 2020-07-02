FROM node:14.4.0

WORKDIR /home/node/app

COPY . .
RUN npm i 

RUN npm install pm2 -g
CMD [ "pm2-runtime", "npm", "--", "start" ]
