const mongoose = require('mongoose');
const express = require('express');

const app = express();

const apiRouter = require('./routes/api');
const bodyParser = require('body-parser');
const jsonParser = bodyParser.json()



require('dotenv').config();

app.use(jsonParser);

let db;

mongoose.connect(
  process.env.DATABASE_CONNECT,
  { useNewUrlParser: true , useUnifiedTopology: true },
  () => {
    console.log('successfully connected to the database');
  }
);


app.get('/', function(req, res) {
  res.send('Homepage');
});

app.use((req,res, next)=>{
  res.setHeader('Access-Control-Allow-Origin',"*");
  res.setHeader('Access-Control-Allow-Headers',"*");
  res.header('Access-Control-Allow-Credentials', true);
  next();
});

app.use('/api', apiRouter);



const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const { swaggerOptions } = require('./swagger/swagger')

const swaggerDocs = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));




app.listen(3000, () => console.log('App Started'));
