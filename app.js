const express= require('express');
const bodyParser= require('body-parser');
const {Pool}= require('pg');
const axios = require('axios');
const multer= require('multer');
const bcrypt= require('bcrypt');
const saltRounds= 10;
const crypto=require('crypto');
const util= require('util');
const uuid = require('uuid');
const nodemailer = require('nodemailer');
const randomstring = require('randomstring');
const flash = require('connect-flash');


const app= express();


const fs = require('fs');
const port= process.env.PORT||3000; 
const path = require('path');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const methodOverride = require('method-override');
const e = require('connect-flash');
const { type, userInfo } = require('os');
const { fileLoader } = require('ejs');
const { language } = require('googleapis/build/src/apis/language');
const { cloudidentity } = require('googleapis/build/src/apis/cloudidentity');
app.use(methodOverride('_method'));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname,'public')));
app.use(express.static(path.join(__dirname,'uploads')));
// app.use(express.static(path.join(__dirname,'images')));
app.use('/uploads',express.static(path.join(__dirname, 'uploads')));
// app.use('/uploads/:id',(req,res,next)=>{
//   const lawyerId = req.params.id;
//   const uploadDir = path.join(__dirname,'uploads',lawyerId);
//   express.static(uploadDir)(req,res,next);
//   // console.log(uploadDir);
// })

// app.use('/lawyerspage',express.static(path.join(__dirname,'public')));
// app.use('/lawyersprofile/:id',express.static(path.join(__dirname,'public')));
// app.use('/lawyersprofile/:id',express.static(path.join(__dirname,'uploads')));
app.use('/articles/:id',express.static(path.join(__dirname,'public')))
app.use('/lawyerspage',express.static(path.join(__dirname,'uploads')));
app.use(bodyParser.urlencoded({extended: true}));
// app.use(express.static("public"));
app.use(express.static("uploads"));
const secretKey = crypto.randomBytes(32).toString('hex');


const pool= new Pool({ 
  user: "postgres",
  host: "144.24.124.135",
  database: "ilegaladvice",
  password: "Pranav@2003",
  port: 5432,
  max: 30,                   
  idleTimeoutMillis: 60000,   
  connectionTimeoutMillis: 3000
});

app.use(session({
  store: new PgSession({
    pool: pool
  }),
  secret: 'secretKey',
  resave: false,
  saveUninitialized: true,
  // cookie: {
  //   maxAge: 1000 * 60 * 60 * 24,
  // }
})  
);

app.use(passport.initialize());
app.use(passport.session());
app.use(flash());
app.use((req,res,next)=>{
  res.locals.successMessage = req.flash('successMessage');
  res.locals.errorMessage = req.flash('errorMessage');
  next(); 
});
app.set('view engine','ejs');
app.set('views',path.join(__dirname,'views'));
app.set('partials',path.join(__dirname,'views/partials'));

app.locals.formatDate = (dateString) => {
  const date = new Date(dateString);
  const options = {year: 'numeric',month: 'long', day: 'numeric', hour:'2-digit', minute:'2-digit', hour12:'false'};
  return date.toLocaleDateString(undefined, options);
}

function roundToOneDecimalPlace(num){
  return parseFloat(num).toFixed(1); 
}

const ensureAuthenticated = (req,res,next) => {
  if(req.isAuthenticated()){
    return next();
  }
  if(req.headers['content-type']==='application/json'){
    return res.status(401).json({success: false,message:'Please sign in to like the article.'})
  }
  res.redirect('/signup');
}
// Set the maximum number of listeners for Express app and router instances
// app.setMaxListeners(15); 
const verifyAuthenticated = (req,res,next)=>{
  if(req.isAuthenticated()){
    return next();
  }
  if(req.headers['content-type']==='application/json'){
    return res.status(401).json({success: false,message:'Please sign in to add a comment.'})
  }
}


const storage = multer.diskStorage({ 
  destination: function(req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req,file,cb) {
    cb(null, file.originalname);
  }
});

const fileFilter = (req, file, cb) => {
  const filetypes = /jpeg|jpg|png|gif/;
  const mimetype = filetypes.test(file.mimetype);
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Invalid file type, only images are allowed!'), false);
  }
};


const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
});

pool.connect((err) => {
  if (err) {
      console.error('Error connecting to PostgreSQL database:', {
          message: err.message,
          code: err.code,
          stack: err.stack,
          detail: err.detail || 'No additional details available'
      });
      return;
  }
  console.log('Connected to PostgreSQL database');
});


function isuAuthenticated(req,res, next) {
  if(req.isAuthenticated()){
    return next();
  } else {       
    req.flash('error','You need to be logged in to to access this page.');
    res.redirect('/signup');
  }
} 

const API_KEY = 'n~6WhjJBL0xogd0yAuFM20TuA';
const clientId = '8437309c-46c6-4516-aa33-69f508d96e49';
const clientSecret = 'MzWOBwS5b5UPacsspQxkWxsNQAmG2EgP';
const searchText = 'lawyers';

let emailSendInProgress = false;

async function getAccessToken(){
  try{
    const response = await axios.post('https://account.olamaps.io/realms/olamaps/protocol/openid-connect/token',
      new URLSearchParams ({
        grant_type: 'client_credentials',
        client_id: '8437309c-46c6-4516-aa33-69f508d96e49',
        client_secret: 'MzWOBwS5b5UPacsspQxkWxsNQAmG2EgP',
        scope: 'openid',
      
    }),
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
    }
    }
  )
    return response.data.access_token

  } catch(error){
    console.error('Error making API request:', error.message);
  }
}

async function geocodeAddress(address) {
  const token = await getAccessToken();
  if(token){
    try{
      console.log("Access Token:", token);
      const response = await axios.get(`https://api.olamaps.io/places/v1/geocode`, {
        params: {
          address: address
        },
        headers: {
            Authorization: `Bearer ${token}`
        }
      });
      const firstResult = response.data?.geocodingResults?.[0];
      if(firstResult){
        const location = firstResult.geometry.location;
        console.log(`Latitude: ${location.lat}, longitude: ${location.lng}`);
        return location;
      } else{
        console.error("No location found for the given addresss");
        return null;
      }
    } catch(error){
      console.error('Error making API request:', error.response ? error.response.data : error.message);
      console.error('Full error object:', error);
    }
  }
}

// geocodeAddress('Shop No.04, YourLawyer - Law Firm, Samanvay CHS Ltd, Plot No.13, beside Bank Of Maharashtra, Block G, Sector 11, Kharghar, Navi Mumbai, Maharashtra 410210 ');

app.get('/about-us',(req,res)=>{
  res.render('aboutus');
})

app.get('/privacy-policy',(req,res)=>{
  res.render('privacy_policy');
})

app.get('/terms-of-use',(req,res)=>{
  res.render('terms-of-use');
})

app.get('/contact-us',(req,res)=>{
  res.render('contact-us')
})

app.get('/crpclist',(req,res)=>{
  res.render('crpclist.ejs');
})

app.get('/bns',(req,res)=>{
  res.render('bnschapters.ejs');
})

app.get('/bns_sections', async (req, res) => {
  const chapter = parseInt(req.query.chapter); 
  if (isNaN(chapter)) {
      return res.status(400).send('Invalid chapter number');
  }
  const query = 'SELECT * FROM bns_sections WHERE chapter_number = $1';
  try {
      const { rows } = await pool.query(query, [chapter]); 
      res.render('BNSsectionlist.ejs', { data: rows });
  } catch (err) {
      console.error('Error executing query:', err);
      res.status(500).send('Server error');
  }
});

app.get('/bns_section', async (req, res) => {
  const section_number = req.query.section_number;
  const query = 'SELECT * FROM bns_sections WHERE section_number = $1';
  
  try {
    const { rows } = await pool.query(query, [section_number]);  
    if (rows.length === 0) {
      return res.status(404).send('Section not found');
    }
    res.render('BNSsection.ejs', { data: rows[0] });  
  } catch (err) {
    console.error('Error executing query:', err);
    res.status(500).send('Server error');
  }
});

app.get('/crpc',async(req,res)=>{
  const chapter = req.query.chapter;
  try{
    var sql = 'select * from crpc_data where chapter_number=$1'
    var crpc = await pool.query(sql,[chapter]);
    console.log(crpc.rows);
    res.render('crpcDrop.ejs',{data: crpc.rows});
  } catch (err) {
    console.error('Error retrieving data from the database:',err);
    res.status(500).send('Internal server error');
  }
})



app.get('/',async(req,res)=>{
  try{
    const result = await pool.query(`
      WITH review_aggregates AS (
      SELECT lawyer_id, AVG(rating) AS average_rating, COUNT(client_id) AS client_count
      FROM reviews
      GROUP BY lawyer_id
    )
   SELECT l.*, ra.average_rating, ra.client_count
   FROM lawyers l
   LEFT JOIN review_aggregates ra ON l.id = ra.lawyer_id
   ORDER BY coalesce(ra.average_rating, 0) DESC, coalesce(ra.client_count,0) DESC
   LIMIT 9
      `);
    const lawyers=result.rows.map(row=>({
        name: row.name,
        yrs_exp: row.yrs_exp,
        image: row.image,
        area_of_prac: row.area_of_prac ? row.area_of_prac.replace(/[{"}]/g, '').split(' , ') : [],
        id: row.id,
        average_rating: row.average_rating || 0,
        client_count: row.client_count || 0,
        city: row.city,
        state: row.states,
    }))
    res.render('homepage.ejs',{lawyers,roundToOneDecimalPlace: roundToOneDecimalPlace});
  } catch(error){
    console.log(error);
  } 
});

app.get('/signup',async(req,res)=>{
  res.render('home3.ejs',{message: '',success: false});
});

app.get('/api',(req,res)=>{
  res.render('api.ejs');
})

app.post('/api/location', async(req, res) => {
  const { latitude, longitude } = req.body;
 try{
  console.log(`Received Latitude: ${latitude}, Longitude: ${longitude}`);
  const searchResults = await searchPlaces(latitude, longitude);
  res.json({ message: 'Location received successfully' });
 } catch(error){
  res.status(500).json({message: 'Error processing location', error: error.message});
 }
});



app.get('/forgetpassword',(req,res)=>{
  res.render('login.ejs');
});

app.get('/reset-password',async(req,res)=>{
  const token = req.query.token;
  try{ 
    const query1 = 'SELECT email FROM lawyers WHERE token = $1';
    const query2 = 'SELECT email FROM clientsignup WHERE token = $1';
    const result1 = await pool.query(query1,[token]);
    const result2 = await pool.query(query2,[token]);
    if(result1.rowCount>0){
      res.render('reset-password',{token});
     }
    else if(result2.rowCount>0){
      res.render('reset-password',{token});
     }
    else{
      return res.status(400).send('Invalid or expired token');
    }
  } catch(error) {
    console.error('Error:', error);
    res.status(500).send('Internal server error');
  }
})

// app.get('/react',(req,res)=>{
//   res.render('react');
// })

  app.get('/allipc', async (req, res) => {
    try {
      const { rows: ipcSections } = await pool.query(`SELECT id,case when offence='nan' then null else '- ' || offence end as offence, substring(ipc_section from 5) as ipc_section FROM ipc_sections`);
      
    
      const noResults = ipcSections.length === 0
    
      res.render('ipclist', { ipc: ipcSections, noResults });
      
    } catch (error) {
      console.error('Error fetching IPC sections:', error);
      res.status(500).send('Internal Server Error');
    }
  });




app.get('/ipc',async(req,res)=>{
  try{
    id = req.query.id;
    const query = `select * from ipc_sections where id=$1`;
    const results = await pool.query(query,[id])
    const ipc = results.rows.map(row=>({
       id: row.id,
       triable: row.triable,
       bail: row.bail,
       cognizance: row.cognizance,
       conclusion: row.conclusion,
       importance: row.importance,
       practical_application: row.practical_application,
       punishment_detailed: row.punishment_detailed,
       offence_detailed: row.offence_detailed,
       ipc_section: row.ipc_section.substring(4),
       punishment: row.punishment,
       offence: row.offence,
       description_split: row.description_split,
       ipc_in_simple_words: row.ipc_in_simple_words
    }))
    res.render('ipc',{ipc})
  } catch{
    console.log(error);
  }

})

app.get('/search-ipc',async(req,res)=>{
  try{
   const searchQuery = req.query.search||'';
   const {rows: ipcSections } = await pool.query(`
    select id,
    substring(ipc_section from 5) as ipc_section,
    case when offence='nan' then null else '- '|| offence end as offence,
    description
    from ipc_sections
    where ipc_section ilike $1
    or offence ilike $1
    or description ilike $1
    `,[`%${searchQuery}%`]);

    const noResults = ipcSections.length === 0
   
    res.render('ipclist',{ipc: ipcSections, noResults});
  } catch(error){
    console.error('Error searching IPC sections:', error);
    res.status(500).send('Internal server error');
  }
})

app.get('/articles',async(req,res)=>{
  const client = await pool.connect();
  const page = parseInt(req.query.page, 10) || 1;
  const limit =  10;
  const offset = (page-1)*limit;
  try{
    const result = await client.query('select a.id, a.title, a.content, a.author_id, l.name as author_name, coalesce(count(lk.article_id),0) as likes_count from articles a left join lawyers l on a.author_id=l.id left join likes lk on a.id = lk.article_id group by a.id,l.name order by likes_count desc limit $1 offset $2',[limit,offset]);
    const countResult = await client.query('select count(*) from articles');
    const totalArticles = parseInt(countResult.rows[0].count, 10);
    const totalPages = Math.ceil(totalArticles/limit);
    const articles = result.rows.map(row=>({
      id: row.id,
      title: row.title,
      content: row.content,
      author_id: row.author_id,
      author_name: row.author_name,
      likes: row.likes_count
    }))
    const noResults = articles.length === 0;
    res.render('articlespage',{articles, currentPage: page, totalPages: totalPages, limit: limit,noResults});
    
   
  }
  catch(error){
    console.error('An error ocurred:',error.message);
  } finally{
    client.release();
  }
})

app.get('/fullarticle',async(req,res)=>{
  
    const client = await pool.connect();
    try{
    const articleId = req.query.articleId;
    const currentUserId = req.user ? req.user.id:null;
    const currentUser = req.user || null;
    const user_role = req.user ? req.user.role: null;
    await client.query('BEGIN');
    const result = await client.query(`select a.*,coalesce(like_count.like_count,0) as like_count
      from articles a
      left join(
      select article_id, count(*) as like_count
      from likes
      where article_id=$1
      group by article_id
    ) as like_count on a.id=like_count.article_id
     where a.id=$1;`,[articleId]);
    const articles = result.rows.map(row=>({
      id: row.id,
      title: row.title,
      content: row.content,
      author_id: row.author_id,
      created_at: row.created_at,
      like_count: row.like_count
    }))
    const authorId = articles[0].author_id;
    const likeCount = articles[0].like_count;
    
    const results = await client.query(
    `WITH review_aggregates AS (
     SELECT 
      lawyer_id,
      AVG(rating) AS average_rating,
      COUNT(client_id) AS client_count
     FROM reviews
     GROUP BY lawyer_id
     )
    SELECT 
    l.*, 
    ra.average_rating, 
    ra.client_count 
    FROM lawyers l
    LEFT JOIN review_aggregates ra ON l.id = ra.lawyer_id
    WHERE l.id = $1`,[authorId]);

    const lawyer = results.rows[0];
    let userLiked;
    if(currentUserId){
      const likeStatusResult = await client.query(`
        select * from likes where user_id=$1 and article_id=$2 and user_role=$3
        `,[currentUserId,articleId,user_role]);
        if(likeStatusResult.rows.length>0){
          userLiked = true;
        } else{
          userLiked = false;
        }
    }

    const commentResult = await client.query(`
      select c.*,
      a.title as article_title,
      coalesce(cs.name,l.name) as username,
      coalesce(cs.id,l.id) as user_id, 
      coalesce(cs.email,l.email) as user_email,
      case
       when cs.id is not null then 'client'
       else 'lawyer'
       end as user_role
       from comments c
       left join articles a on c.article_id = a.id
       left join clientsignup cs on c.user_id = cs.id and c.user_role='client'
       left join lawyers l on c.user_id = l.id and c.user_role = 'lawyer'
       where c.article_id = $1
       order by c.created_at desc 
      `,[articleId]);
      const comments = commentResult.rows;

    const repliesResult = await client.query(`
      select r.*,coalesce(cs.name,l.name) as username,
      coalesce(cs.id,l.id) as user_id,
      coalesce(cs.email,l.email) as user_email,
      case
      when cs.id is not null then 'client'
      else 'lawyer'
      end as user_role
      from replies r
      left join clientsignup cs on r.user_id = cs.id and r.user_role='client'
      left join lawyers l on r.user_id = l.id and r.user_role='lawyer'
      where r.comment_id in (select id from comments where article_id=$1)
      order by r.created_at desc
      `,[articleId]);
      const replies = repliesResult.rows;

    await client.query('COMMIT');
    res.render('fullarticle',{roundToOneDecimalPlace:roundToOneDecimalPlace,lawyer,likeCount,articles,articleId,currentUserId,currentUser,userLiked,comments,replies});
  } catch(error){
      await client.query('ROLLBACK');
      console.error('An error ocurred:',error.message);
  } finally{
    client.release();
  }
})


app.get('/userAccount',isuAuthenticated,async(req,res)=>{
  try{
   
    if(req.user.role==='lawyer'){
      const userId = req.user.id;
      const reviewsResult= await pool.query(`
      with review_aggregates as(
      select lawyer_id,
      avg(rating) as average_rating,
      count(client_id) as client_count
      from reviews
      where lawyer_id=$1
      group by lawyer_id
     )
      select r.*,c.name,
      ra.average_rating,
      ra.client_count
      from reviews r
      join clientsignup c on r.client_id = c.id
      join lawyers l on r.lawyer_id= l.id
      left join review_aggregates ra on ra.lawyer_id=r.lawyer_id
      where r.lawyer_id = $1
      group by r.id, c.name, ra.average_rating, ra.client_count
      order by r.created_at desc
     `,[userId]);
     let reviews= [];
     let averageRating = 0;
     let clientCount = 0;
   
     if (reviewsResult.rowCount>0){
       reviews = reviewsResult.rows;
       averageRating = reviewsResult.rows[0].average_rating;
       clientCount = reviewsResult.rows[0].client_count;
     }
     const articlesResult = await pool.query(`
      select a.id,
      a.title,
      a.content,
      a.author_id,
      a.created_at,
      coalesce(count(l.user_id)::integer, 0) as like_count
      from articles a 
      left join likes l on a.id = l.article_id
      where a.author_id = $1 
      group by a.id 
      order by a.created_at desc`,[userId]
    );

    const articles = articlesResult.rows.map(article=>({
      id: article.id,
      title: article.title,
      content: article.content,
      created_at: article.created_at,
      likes: parseInt(article.like_count,10)
    }));

      res.render('lawyeraccount',{user: req.user, reviews, averageRating:parseFloat(averageRating)||0, clientCount:clientCount||0,articles});
    } else {
      res.render('clientaccount',{user: req.user});
    }
  } catch(err){
    console.log(err);
  }  
});


app.get('/lawyersprofile',async(req,res)=>{
const client = await pool.connect();
const lawyerId = req.query.lawyerId;
console.log(lawyerId);
const currentUser= req.user||null;
try{
  await client.query('BEGIN');
  const query =  await client.query('SELECT * FROM lawyers WHERE id=$1',[lawyerId]);
    const lawyers = query.rows.map(row=>{
      let image = row.image;
      if(image) {
       image=image.substring(8);
      }
      // console.log(image);
      return {
        name: row.name,
        yrs_exp: row.yrs_exp,
        image: image,
        area_of_prac: row.area_of_prac?row.area_of_prac.replace(/[{"}]/g,'').split(','): [],
        id: row.id,
        bio: row.bio,
        language: row.language?row.language.replace(/[{"}]/g,'').split(','): [],
        city: row.city,
        state: row.states,
        courts: row.courts
      }
   
}); 
    
  const reviewsResult= await client.query(`
   with review_aggregates as(
    select lawyer_id,
   avg(rating) as average_rating,
   count(client_id) as client_count
   from reviews
   where lawyer_id=$1
   group by lawyer_id
  )
   select r.*,c.name,
   ra.average_rating,
   ra.client_count
   from reviews r
   join clientsignup c on r.client_id = c.id
   join lawyers l on r.lawyer_id= l.id
   left join review_aggregates ra on ra.lawyer_id=r.lawyer_id
   where r.lawyer_id = $1
   group by r.id, c.name, ra.average_rating, ra.client_count
   order by r.created_at desc
  `,[lawyerId]);

  let reviews= [];
  let averageRating = 0;
  let clientCount = 0;

  if (reviewsResult.rowCount>0){
    reviews = reviewsResult.rows;
    averageRating = reviewsResult.rows[0].average_rating;
    clientCount = reviewsResult.rows[0].client_count;
  }
  await client.query('COMMIT');
  res.render('lawyerprofile',{lawyerId,lawyers,currentUser, reviews, averageRating:parseFloat(averageRating)||0, clientCount:clientCount||0, successMessage: req.flash('success'),errorMessage: req.flash('error')});
 
 } catch (error){
    await client.query('ROLLBACK');
    console.error('Error fetching lawyers:', error);
    res.status(500).send('Internal server error');
 } finally{
    client.release();
 }
})


app.get('/lawyerspage', async(req, res) => {  
  const client = await pool.connect();
try{
  const userLat = req.query.latitude;
  console.log(userLat);
  const userLon = req.query.longitude;
  const law = req.query.law;
  console.log(userLon);
  const cityFilter = req.query.cityFilter;
  const stateFilter = req.query.state;
  const aopFilter = req.query.areaofpractice;
  const experienceFilter = req.query.experience;
  const languageFilter = req.query.language;
  const genderFilter = req.query.gender;
  const ratingFilter = req.query.rating;
  const city = req.query.city;
  const language = req.query.language;
  const search = req.query.search||'';
  const page = parseInt(req.query.page, 10) || 1;
  // console.log(page)
  const limit = 10; 
  const offset = (page-1) * limit;
  
  let result;

  if(userLat && userLon) {
    const result = await client.query(`
      with review_aggregates as(
      select lawyer_id,
      avg(rating) as average_rating,
      count(client_id) as client_count
      from reviews
      group by lawyer_id     
     )
      select
      l.*,
      ra.average_rating,
      ra.client_count,
      ST_Distance(
      ST_SetSRID(ST_MakePoint(l.longitude,l.latitude), 4326)::geography,
      ST_SetSRID(ST_MakePoint($1,$2), 4326)::geography
      )/1000 as distance
      from lawyers l
      left join review_aggregates ra on l.id=ra.lawyer_id
      where ST_Distance(
      ST_SetSRID(ST_MakePoint(l.longitude, l.latitude), 4326):: geography,
      ST_SetSRID(ST_MakePoint($1,$2), 4326):: geography
      ) / 1000 <= 10
      order by distance ASC
    `,[userLon,userLat]);
   
     var lawyers = result.rows.map(row=>{
   
     let image = row.image;
     if(image){
       image=image.substring(8);
     }
     console.log(`Lawyer ID: ${row.id}, Name: ${row.name}, Distance from user: ${row.distance} Kilometers`);
     return{
       name: row.name,
       yrs_exp: row.yrs_exp,
       image: image,
       area_of_prac: row.area_of_prac?row.area_of_prac.replace(/[{"}]/g,'').split(' , ') : [],
       id: row.id,
       average_rating: row.average_rating || 0,
       client_count: row.client_count || 0,
       city: row.city,
       state: row.states,
       distance: parseFloat(row.distance).toFixed(2)
     }
   });
   console.log(lawyers);
   // lawyers.sort((a, b) => a.distance - b.distance);  
   res.render('lawyerspage.ejs',{
     roundToOneDecimalPlace: roundToOneDecimalPlace,
     lawyers: lawyers,
     currentPage: 1,
     totalPages: 1,
     limit: limit,
     noResults: lawyers.length === 0,
     userLat,
     userLon,
     law,
     city,
     language,
     cityFilter,
     stateFilter,
     aopFilter,
     ratingFilter,
     languageFilter,
     genderFilter,
     experienceFilter,
     search,
   })
  }
else{
  const countResult = await client.query(`
    SELECT COUNT(*) AS total_lawyers
    FROM lawyers
  `);
  const totalLawyers = parseInt(countResult.rows[0].total_lawyers, 10);
  const totalPages = Math.ceil(totalLawyers / limit);
  result = await client.query(`
        WITH review_aggregates AS (
          SELECT lawyer_id, AVG(rating) AS average_rating, COUNT(client_id) AS client_count
          FROM reviews
          GROUP BY lawyer_id
        )
        SELECT l.*, ra.average_rating, ra.client_count
        FROM lawyers l
        LEFT JOIN review_aggregates ra ON l.id = ra.lawyer_id
        ORDER BY ra.average_rating asc, ra.client_count asc
        LIMIT $1 OFFSET $2`, [limit, offset]
  )
  var lawyers  = result.rows.map(row=>{
    let image = row.image ? row.image.substring(8) : null;
    return {
      name: row.name,
      yrs_exp: row.yrs_exp,
      image: image,
      area_of_prac: row.area_of_prac ? row.area_of_prac.replace(/[{"}]/g, '').split(' , ') : [],
      id: row.id,
      average_rating: row.average_rating || 0,
      client_count: row.client_count || 0,
      city: row.city,
      state: row.states,
    }
  })

  res.render('lawyerspage.ejs',{
    roundToOneDecimalPlace:roundToOneDecimalPlace, 
    lawyers: lawyers,
    currentPage: page,
    totalPages: totalPages,
    limit: limit,
    noResults: lawyers.length === 0,
    userLat: null,
    userLon: null,
    law,
    city,
    language,
    cityFilter,
    stateFilter,
    aopFilter,
    ratingFilter,
    languageFilter,
    genderFilter,
    experienceFilter,
    search
    })
}
}
// const paginatedLawyers = lawyers.slice(offset, offset+limit)
// console.log(paginatedLawyers);
// console.log(paginatedLawyers);
// let averageRating = 0;
// let clientCount = 0;



// console.log(lawyers);
// console.log(reviewsResult.rowCount);

 catch(error) {
    console.error('Error:', error);
    res.status(500).send('Internal server error');
  } finally{
    client.release();
  }
})

app.get('/filter-lawyers', async (req, res) => {
  const userLat = 19.029364866883935;
  const userLon = 73.06286644778044;
  const cityFilter = req.query.cityFilter;
  const stateFilter = req.query.state;
  const aopFilter = req.query.areaofpractice;
  const experienceFilter = req.query.experience;
  const languageFilter = req.query.language;
  const genderFilter = req.query.gender;
  const ratingFilter = req.query.rating;
  const law = req.query.law;
  const city = req.query.city;
  const language = req.query.language;
  const search = req.query.search||'';

  const page = parseInt(req.query.page, 10) || 1;
  const limit = 10;
  const offset = (page - 1) * limit;

  let countQuery = `SELECT count(DISTINCT l.id) as total_count FROM lawyers l LEFT JOIN reviews r ON l.id = r.lawyer_id WHERE 1=1`;
  
  let query = `
    SELECT l.id, l.name, l.yrs_exp, l.image, l.city, l.states, l.gender, l.language,
           l.area_of_prac, AVG(r.rating) AS average_rating, COUNT(r.client_id) AS client_count
    FROM lawyers l
    LEFT JOIN reviews r ON l.id = r.lawyer_id
    WHERE 1=1
  `;

  let queryParams = [];
  let countParams = [];

  if (stateFilter) {
    queryParams.push(stateFilter);
    countParams.push(stateFilter);
    query += ` AND l.states = $${queryParams.length}`;
    countQuery += ` AND l.states = $${countParams.length}`;
  }

  if (cityFilter) {
    queryParams.push(cityFilter);
    countParams.push(cityFilter);
    query += ` AND l.city = $${queryParams.length}`;
    countQuery += ` AND l.city = $${countParams.length}`;
  }

  if (experienceFilter) {
    if (experienceFilter === 'Less than 5 Years') {
      queryParams.push(5);
      countParams.push(5);
      query += ` AND l.yrs_exp < $${queryParams.length}`;
      countQuery += ` AND l.yrs_exp < $${countParams.length}`;
    } else if (experienceFilter === 'Greater than 20 Years') {
      queryParams.push(20);
      countParams.push(20);
      query += ` AND l.yrs_exp >= $${queryParams.length}`;
      countQuery += ` AND l.yrs_exp >= $${countParams.length}`;
    } else {
      const [minExp, maxExp] = experienceFilter.split('-').map(Number);
      if (!isNaN(minExp) && !isNaN(maxExp)) {
        queryParams.push(minExp);
        countParams.push(minExp);
        query += ` AND l.yrs_exp >= $${queryParams.length}`;
        countQuery += ` AND l.yrs_exp >= $${countParams.length}`;

        queryParams.push(maxExp);
        countParams.push(maxExp);
        query += ` AND l.yrs_exp <= $${queryParams.length}`;
        countQuery += ` AND l.yrs_exp <= $${queryParams.length}`;
      } else {
        console.error('Invalid experience range format in experienceFilter:', experienceFilter);
      }
    }
  }

  if (aopFilter) {
    const aopParam = `%${aopFilter}%`;
    queryParams.push(aopParam);
    countParams.push(aopParam);
    query += ` AND l.area_of_prac ILIKE $${queryParams.length}`;
    countQuery += ` AND l.area_of_prac ILIKE $${countParams.length}`;
  }

  if (genderFilter) {
    queryParams.push(genderFilter);
    countParams.push(genderFilter);
    query += ` AND l.gender = $${queryParams.length}`;
    countQuery += ` AND l.gender = $${countParams.length}`;
  }

  if (languageFilter) {
    queryParams.push(`%${languageFilter}%`);
    countParams.push(`%${languageFilter}%`);
    query += ` AND l.language ILIKE $${queryParams.length}`;
    countQuery += ` AND l.language ILIKE $${countParams.length}`;
  }

 
  query += ` GROUP BY l.id, l.name, l.yrs_exp, l.image, l.area_of_prac, l.city, l.states, l.gender, l.language`;

  if (ratingFilter) {
    if (ratingFilter.includes('-')) {
      const [minRating, maxRating] = ratingFilter.split('-').map(Number);
      if (!isNaN(minRating) && !isNaN(maxRating)) {
        query += ` HAVING AVG(COALESCE(r.rating, 0)) BETWEEN $${queryParams.length + 1} AND $${queryParams.length + 2}`;
        queryParams.push(minRating, maxRating);
      } else {
        console.error('Invalid rating range format in ratingFilter:', ratingFilter);
      }
    } else {
      const exactRating = Number(ratingFilter);
      if (!isNaN(exactRating)) {
        query += ` HAVING AVG(COALESCE(r.rating, 0)) = $${queryParams.length + 1}`;
        queryParams.push(exactRating);
      } else {
        console.error('Invalid rating value in ratingFilter:', ratingFilter);
      }
    }
  }

 
  query += ` ORDER BY l.id ASC LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
  queryParams.push(limit, offset);

  console.log('Query Params:', queryParams);

  try {
    const countResult = await pool.query(countQuery, countParams);
    const totalRecords = parseInt(countResult.rows[0].total_count, 10);
    const totalPages = Math.ceil(totalRecords / limit);

    const result = await pool.query(query, queryParams);

    const lawyers = result.rows.map(row => {
      let image = row.image;
      if (image) {
        image = image.substring(8);
      }

      return {
        name: row.name,
        yrs_exp: row.yrs_exp,
        image: image,
        area_of_prac: row.area_of_prac ? row.area_of_prac.replace(/[{"}]/g, '').split(' , ') : [],
        id: row.id,
        average_rating: parseFloat(row.average_rating).toFixed(2) || 0,
        client_count: row.client_count || 0,
        city: row.city,
        state: row.states,
      };
    });

    const noResults = lawyers.length === 0;

    res.render('lawyerspage', {
      roundToOneDecimalPlace: roundToOneDecimalPlace,
      lawyers,
      currentPage: page,
      totalPages,
      limit,
      noResults,
      userLat,
      userLon,
      law,
      city,
      language,
      cityFilter,
      stateFilter,
      aopFilter,
      ratingFilter,
      languageFilter,
      genderFilter,
      experienceFilter,
      search
    });
  } catch (err) {
    console.error('Error executing query', err);
    res.status(500).send('Internal Server error');
  }
});

app.get('/verify-email', async(req,res)=>{
  const token = req.query.token;
  console.log(token)
  try{
    result = await pool.query('select * from clientsignup where verification_token = $1',[token]);
    console.log(result);
    if(result.rowCount === 0){
      result = await pool.query('SELECT * FROM lawyers WHERE verification_token = $1', [token]);
      if (result.rowCount === 0) {
        return res.status(400).send('Invalid token or token has expired.');
      }
      await pool.query('UPDATE lawyers SET is_verified = TRUE, verification_token = NULL WHERE verification_token = $1', [token]);
      return res.render('home3', { message: 'Lawyer email verified successfully! Please login now.', success: true });
    }
    await pool.query('update clientsignup set is_verified = TRUE, verification_token = NULL where verification_token = $1',[token]);
    res.render('home3',{message: 'Email verified successfully! Please login now.', success: true});
  } catch(error){
    console.error('Error verifying email:', error);
    res.status(500).send('Internal server error');
  }
})


app.get('/search-lawyers', async(req, res) => {  
  const client = await pool.connect();
try{
  await client.query('BEGIN');
  const cityFilter = req.query.cityFilter;
  const stateFilter = req.query.state;
  const aopFilter = req.query.areaofpractice;
  const experienceFilter = req.query.experience;
  const languageFilter = req.query.language;
  const genderFilter = req.query.gender;
  const ratingFilter = req.query.rating;
  const law = req.query.law;
  const city = req.query.city;
  const language = req.query.language;
  const page = parseInt(req.query.page, 10) || 1;
  const limit = 10; 
  const offset = (page-1) * limit;
  const search = req.query.search||'';
  const searchWords = search.split(' ').map(word => `%${word}%`);
  const whereClauses = searchWords.map((_, index) => `(name ilike $${index+1} or area_of_prac ilike $${index+1})`);
  const whereClause = whereClauses.join(' OR ');

  const searchLawyersResult = `select count(*) from lawyers where ${whereClause}`;
  // const values =`%${searchWords}%`;
  const result1 = await client.query(searchLawyersResult, searchWords);
  const totalLawyers = parseInt(result1.rows[0].count, 10);
  const totalPages = Math.ceil(totalLawyers/limit);

  const result = await client.query(`
  with review_aggregates as(
   select lawyer_id,
   avg(rating) as average_rating,
   count(client_id) as client_count
   from reviews
   group by lawyer_id
  )
   select
   l.*,
   ra.average_rating,
   ra.client_count
   from lawyers l
   left join review_aggregates ra on l.id=ra.lawyer_id
   where ${whereClause}
   order by ra.average_rating desc nulls last
   limit $${searchWords.length+1} offset $${searchWords.length+2}
 `,[...searchWords,limit,offset]);

  const lawyers = result.rows.map(row=>{

  let image = row.image;
  if(image){
    image=image.substring(8);
  }
  return{
    name: row.name,
    yrs_exp: row.yrs_exp,
    image: image,
    area_of_prac: row.area_of_prac?row.area_of_prac.replace(/[{"}]/g,'').split(' , ') : [],
    id: row.id,
    average_rating: row.average_rating || 0,
    client_count: row.client_count || 0,
    state: row.states,
    city: row.city
  }

});
            
await client.query('COMMIT');

const noResults = lawyers.length === 0;

// let averageRating = 0;
// let clientCount = 0;

// console.log(reviewsResult.rowCount);
res.render('lawyerspage.ejs',{
roundToOneDecimalPlace:roundToOneDecimalPlace, 
lawyers,
currentPage: page,
totalPages,
limit,
offset,
law,
city,
language,
cityFilter,
stateFilter,
aopFilter,
ratingFilter,
languageFilter,
genderFilter,
experienceFilter,
noResults,
search
})
  }  catch(error) {
    await client.query('ROLLBACK');
    console.error('Error:', error);
    res.status(500).send('Internal server error');
  } finally{
    client.release();
  }
})

app.get('/search-homepage-lawyers', async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = 10;
  const offset = (page - 1) * limit;
  const law = req.query.law;
  console.log(law);
  const city = req.query.city;
  const cityFilter = req.query.city;
  const language = req.query.homeLanguage;
  const aopFilter = req.query.areaofpractice;
  const experienceFilter = req.query.experience;
  const languageFilter = req.query.language;
  const genderFilter = req.query.gender;
  const ratingFilter = req.query.rating;
  const stateFilter = req.query.state;
  const search = req.query.search||'';
  const queryParams = [];
  let whereClause = [];

  // 1. Apply stricter match for "law" (area of practice)
  if (law) {
    const lawWords = law.split(/[-\s]+/);
    lawWords.forEach((word) => {
      queryParams.push(`%${word}%`);
      whereClause.push(`l.area_of_prac ILIKE ANY(ARRAY[$${queryParams.length}])`);
    });
  }

  // 2. Apply city filter
  if (city) {
    queryParams.push(`%${city}%`);
    whereClause.push(`l.city ILIKE $${queryParams.length}`);
  }

  // 3. Apply language filter
  if (language) {
    queryParams.push(`%${language}%`);
    whereClause.push(`l.language ILIKE $${queryParams.length}`);
  }

  const whereClauseString = whereClause.length > 0 ? `WHERE ${whereClause.join(' AND ')}` : '';

  try {
    // 1. Query to count total number of lawyers matching the filters
    const totalLawyersResult = await pool.query(`
      SELECT COUNT(*) as total_count
      FROM lawyers l
      ${whereClauseString}
    `, queryParams);
    
    const totalLawyers = parseInt(totalLawyersResult.rows[0].total_count, 10);
    const totalPages = Math.ceil(totalLawyers / limit);

    // 2. Query to fetch the current page of lawyers
    const result = await pool.query(`
      WITH review_aggregates AS (
        SELECT 
          lawyer_id, 
          AVG(rating) AS average_rating, 
          COUNT(client_id) AS client_count 
        FROM reviews 
        GROUP BY lawyer_id
      )
      SELECT
        l.*,
        ra.average_rating,
        ra.client_count
      FROM lawyers l
      LEFT JOIN review_aggregates ra ON l.id = ra.lawyer_id
      ${whereClauseString}
      ORDER BY ra.average_rating DESC, ra.client_count DESC
      LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
    `, [...queryParams, limit, offset]);

    // 3. Map result rows to appropriate format
    const lawyers = result.rows.map(row => {
      let image = row.image;
      if (image) {
        image = image.substring(8);
      }
      return {
        name: row.name,
        yrs_exp: row.yrs_exp,
        image: image,
        area_of_prac: row.area_of_prac ? row.area_of_prac.replace(/[{"}]/g, '').split(' , ') : [],
        id: row.id,
        average_rating: row.average_rating || 0,
        client_count: row.client_count || 0,
        city: row.city,
        state: row.states,
      };
    });

    const noResults = lawyers.length === 0;

    // 4. Render the results and pagination
    res.render('lawyerspage', {
      roundToOneDecimalPlace,
      lawyers,
      currentPage: page,
      totalPages,
      limit,
      noResults,
      law,
      city,
      language,
      aopFilter,
      experienceFilter,
      genderFilter,
      ratingFilter,
      stateFilter,
      languageFilter,
      cityFilter,
      search
    });

  } catch (error) {
    console.error('Error fetching lawyers:', error);
    res.status(500).send('Internal Server Error');
  }
});




app.get('/search-articles',async(req,res)=>{
  try{
   const page = parseInt(req.query.page, 10) || 1;
   const limit = 10;
   const offset = (page -1)*limit;
   const search = req.query.search || '';
   const searchWords = search.split(' ').map(word => `%${word}%`);
   const whereClauses = searchWords.map((_, index)=>`(a.title ilike $${index+1} or l.name ilike $${index+1})`);
   const whereClause = whereClauses.length>0?`where ${whereClauses.join(' OR ')}` : '';
   const result = await pool.query(`
    select a.id, a.title, a.content, a.author_id, l.name as author_name,
    coalesce(count(lk.article_id), 0) as likes_count
    from articles a 
    left join lawyers l on a.author_id = l.id
    left join likes lk on a.id = lk.article_id
    ${whereClause}
    group by a.id, l.name
    order by likes_count desc
    limit $${searchWords.length+1} offset $${searchWords.length+2}
    `,[...searchWords, limit, offset]);

    const countResult = await pool.query(`
      select count(*) from articles a
      left join lawyers l on a.author_id = l.id
      ${whereClause}
      `,searchWords);

      const totalArticles = parseInt(countResult.rows[0].count,10);
      const totalPages = Math.ceil(totalArticles / limit);

      const articles = result.rows.map(row => ({
        id: row.id,
        title: row.title,
        content: row.content,
        author_id: row.author_id,
        author_name: row.author_name,
        likes: parseInt(row.likes_count,10),
      }))

      const noResults = articles.length === 0;
      
      res.render('articlespage',{
        articles,
        currentPage: page,
        totalPages: totalPages,
        limit: limit,
        search: search,
        noResults,
      })
    }  catch(error) {
      console.error('Error:', error);
      res.status(500).send('Internal server error');
    } 
})

app.get('/articlewriting',(req,res)=>{
  res.render('articlewriting');
})

app.post('/signup', upload.single('image'), async (req, res) => {
  if (emailSendInProgress) {
    return res.render('home3', { message: 'Kindly check your email to verify your account', success: false });
  }

  emailSendInProgress = true;
  let responseMessage = { message: 'An error occurred. Please try again.', success: false };
  const formType = req.query.formType;
  const saltRounds = 10; 

  try {
  
    if (formType === 'form1') {
      const { passw, cpassw, name, email, phone: c_no } = req.body;
      
      if (passw !== cpassw) {
        responseMessage = { message: 'Password and confirm password do not match, please try again.', success: false };
      } else {
        const hash = await bcrypt.hash(passw, saltRounds);
        const result = await pool.query('SELECT email FROM clientsignup WHERE email = $1', [email]);
        const result1 = await pool.query('SELECT email FROM lawyers WHERE email = $1', [email]);

        if (result.rowCount > 0 || result1.rowCount > 0) {
          responseMessage = { message: 'User already exists, please use a different email id.', success: false };
        } else {
          const token = crypto.randomBytes(32).toString('hex');
          const verificationLink = `https://www.ilegaladvice.com/verify-email?token=${token}`;

          const mailOptions = {
            from: 'ilegaladvice26@gmail.com',
            to: email,
            subject: 'Email Verification',
            text: `Hello ${name}, please verify your email by clicking the following link: ${verificationLink}`,
          };

          const transporter = nodemailer.createTransport({
            service: 'gmail',
            port: 465,
            auth: {
              user: 'ilegaladvice26@gmail.com',
              pass: 'dnfz hpgh rsfm pelx',
            },
            pool: true,
          });

          await transporter.sendMail(mailOptions);
          const sql = "INSERT INTO clientsignup (name, email, passw, cpassw, c_no, verification_token, is_verified) VALUES($1, $2, $3, $4, $5, $6, $7)";
          await pool.query(sql, [name, email, hash, hash, c_no, token, false]);

          responseMessage = { message: 'User registered! Please verify your email to complete registration.', success: true };
        }
      }
    }

    else if (formType === 'form2') {
      if (!req.file) {
        responseMessage = { message: 'Invalid file type, only images are allowed!', success: false };
      } else {
        const { l_password, l_c_password, l_name: name, l_email: email, phone: c_no, areaofpractice: area_of_prac, state, city, experience: yrs_exp, bio, gender, language, courts, address, lic_no } = req.body;

       
        if (l_password !== l_c_password) {
          responseMessage = { message: 'Password and confirm password do not match, please try again.', success: false };
        } else {
          const passw = await bcrypt.hash(l_password, saltRounds);
          const imageBuffer = req.file.path;

          const result = await pool.query('SELECT email FROM lawyers WHERE email = $1', [email]);
          const result1 = await pool.query('SELECT email FROM clientsignup WHERE email = $1', [email]);

          if (result.rowCount > 0 || result1.rowCount > 0) {
            responseMessage = { message: 'User already exists, please use a different email id.', success: false };
          } else {
            let location;
            try {
              location = await geocodeAddress(address);
            } catch (error) {
              console.error('Geocoding failed:', error);
            }

            const latitude = location ? location.lat : null;
            const longitude = location ? location.lng : null;

            const token = crypto.randomBytes(32).toString('hex');
            const verificationLink = `https://www.ilegaladvice.com/verify-email?token=${token}`;

            const mailOptions = {
              from: 'ilegaladvice26@gmail.com',
              to: email,
              subject: 'Email Verification',
              text: `Hello ${name}, please verify your email by clicking the following link: ${verificationLink}`,
            };

            const transporter = nodemailer.createTransport({
              service: 'gmail',
              port: 465,
              auth: {
                user: 'ilegaladvice26@gmail.com',
                pass: 'dnfz hpgh rsfm pelx',
              },
              pool: true,
            });

            await transporter.sendMail(mailOptions);
            const sql1 = 'INSERT INTO lawyers (name, email, passw, cpassw, c_no, area_of_prac, states, city, yrs_exp, bio, image, gender, language, courts, verification_token, is_verified, latitude, longitude, address, lic_no) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)';
            await pool.query(sql1, [name, email, passw, passw, c_no, area_of_prac, state, city, yrs_exp, bio, imageBuffer, gender, language, courts, token, false, latitude, longitude, address, lic_no]);

            responseMessage = { message: 'User registered! Please verify your email to complete registration.', success: true };
          }
        }
      }
    } else {
      responseMessage = { message: 'Invalid form type', success: false };
    }
  } catch (error) {
    console.error('Internal error:', error);
    responseMessage = { message: 'Internal server error. Please try again later.', success: false };
  } finally {
    emailSendInProgress = false;
    res.render('home3', responseMessage); 
  }
});

app.post('/upload',upload.single('upload'),(req,res)=>{
  res.json({
    url: `/uploads/${req.file.filename}`
  })
})

app.post('/fullarticle/review',verifyAuthenticated,async(req,res)=>{
 try {
  const articleId = req.body.articleId;
  const user_id = req.user.id;
  const user_role = req.user.role;
  const comment = req.body.comment;
  await pool.query('insert into comments(article_id,user_id,content,user_role) values ($1,$2,$3,$4)',[articleId,user_id,comment,user_role]);
  res.json({success: true, message: 'Comment submitted successfully!'});
 } catch(error) {
   console.error('error submitting review:',error);
   res.json({success:false,message:'Error submitting review. Please try again later.'})
 }
})

// app.post('/fullarticle/review/:reviewid',async(req,res)=>{
//   const reviewId = req.params.reviewid;
//   try{
//      await pool.query('delete from comments where id=$1',[reviewid]);
//      res.json({success: true, message:'Comment deleted successfully!'});
//   } catch{
//     console.error('Error deleting review:',error);
//     res.json({success: false, message:'Failed to delete review'});
//   }
// })

app.post('/add-reply',verifyAuthenticated,async(req,res)=>{
  const commentId = req.body.commentId;
  const content = req.body.content;
  const userId = req.user.id;
  const userRole = req.user.role;
  const client = await pool.connect();
  try{
    
    await client.query('BEGIN');
    const queryText=`
    insert into replies (comment_id,user_id,user_role,content)
    values ($1,$2,$3,$4)
    `;
    const values = [commentId, userId, userRole, content];
    const result = await client.query(queryText, values);
    await client.query('COMMIT');
    res.json({success:true, message:'Reply submitted sucessfully!'});
  } catch(error){
    await client.query('ROLLBACK');
    console.error('Error addding reply:',error);
    res.status(500).json({success: false, message: 'Error sumbitting reply, please try again later.'});
  } finally{
    client.release();
  }
})

app.post('/lawyersprofile/review',verifyAuthenticated,async(req,res)=>{
  try{ 
    const lawyerId = req.body.lawyerId;
    const {rating, comment} = req.body;
    const userId = req.user.id;
    const userName= req.user.name;
    // console.log(userName);
    // const result = await pool.query('select name from lawyers where id=$1',[lawyerId]);
    // const lawyerName = result.rows[0].name;
    await pool.query('insert into reviews (client_id, lawyer_id, rating, comment, name) values ($1,$2,$3,$4,$5)',[userId, lawyerId, rating, comment,userName]);
    res.json({success: true, message: 'Review submitted successfully!'});
  } catch(error) {
    console.error('error submitting review:',error);
    res.json({success: false, message:'Error submitting review. Please try again later.'});
  }
})

app.delete('/lawyersprofile/reviews/:reviewid',async(req,res)=>{
  const reviewId = req.params.reviewid;
  try{
    await pool.query('delete from reviews where id=$1',[reviewId]);
    res.json({success: true, message: 'Review deleted successfully!'});
  } catch{
    console.error('Error deleting review:',error);
    res.json({success: false, message:'Failed to delete review'});
  }
})

app.delete('/fullarticle/del-reply/:replyId',async(req,res)=>{
  const replyId = req.params.replyId;
  try{
    await pool.query('delete from replies where id=$1',[replyId]);
    res.json({success: true, message: 'Reply deleted successfully!'});
  } catch{
    console.error('Error deleting review:',error);
    res.json({success: false, message:'Failed to delete review'});
  }
})

app.delete('/fullarticle/comment/:commentId',async(req,res)=>{
  const commentId = req.params.commentId;
  try{
    await pool.query('delete from comments where id=$1',[commentId]);
    res.json({success: true, message: 'Comment deleted successfully!'});
  } catch{
    console.error('Error deleting review:',error);
    res.json({success: false, message:'Failed to delete review'});
  }
})



// app.post('/lawyers/:lawyerId/review/:reviewId/reply',isuAuthenticated, async(req,res) => {
//   const {lawyerId,reviewId} = req.params;
//   const reply = req.body.comment;
//   const userId = req.user.id;
//   const userName = req.user.name;
//   const userRole = req.user.role;
//   console.log(userRole);
//   try {
//     if(userRole==='client'){
//       await pool.query('insert into replies (review_id, client_id, comment) values ($1,$2,$3)',[reviewId,userId,reply]);
//     }
//     else{
//       await pool.query('insert into replies (review_id, lawyer_id, comment, lawyer_reply) values ($1,$2,$3,$4)',[reviewId,userId,reply,userName]);
//     }
//     req.flash('successMessage','Reply submitted successfully.');
//     const result = await pool.query('select name from lawyers where id=$1',[lawyerId]);
//     const lawyerName = result.rows[0].name;
//     res.redirect(`/lawyersprofile/${lawyerName}`)
//   } catch(err){
//      console.error(err.message);
//   }
// })

app.post('/login',(req,res,next)=>{
  passport.authenticate('client-login',async(err,user,info)=>{
    if(err){
      return next(err);
    }
    if(!user){
      return res.json({ success: false, message: 'Invalid login credentials. Please try again' });
    }
    try{
      let result;
      let userData;
      // console.log(user.email)
       result = await pool.query('select * from clientsignup where email = $1',[user.email]);
      if (result.rowCount > 0) {
        userData = result.rows[0];
         if (!userData.is_verified) {
          return res.json({ success: false, message: 'Please verify your email before logging in(client).' });
        }
      } else{
        result = await pool.query('SELECT * FROM lawyers WHERE email = $1', [user.email]);
        if (result.rowCount > 0) {
          userData = result.rows[0];
          if (!userData.is_verified) {
            return res.json({ success: false, message: 'Please verify your email before logging in(lawyer).' });
          }
      } else{
        return res.json({ success: false, message: 'Invalid login credentials.' });
      }
    }  
    req.login(user,(err)=>{
      if(err) {
        console.error('Error during login:',err);
        return next(err);
      }
      // req.flash('successMessage','Login successful!');
      return res.json({ success: true, message: 'User logged in successfully!' });
    });
  } catch(error){
    console.error('Error during login:', error);
    return res.status(500).send('Internal server error');
  }
}) (req,res,next);
})


// res.render('home',{message: 'User already exists, please use different email id.', success: false});


const sendEmailWithRetry = async (mailOptions, transporter, retries = 3) => {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      await transporter.sendMail(mailOptions);
      return { success: true };
    } catch (error) {
      console.error(`Attempt ${attempt + 1} failed:`, error);
      if (attempt === retries - 1) return { success: false, error: 'Email sending failed after retries' };
    }
  }
};

app.post('/lawyersprofile', async (req, res) => {
  let responseMessage = { success: false, message: 'An error occurred. Please try again later.' };

  if (emailSendInProgress) {
    responseMessage.message = 'Email is already being sent. Please wait.';
    return res.json(responseMessage);
  }

  const lawyerId = req.query.lawyerId;
  const { email, phone: c_no, name } = req.body;
  const query = 'SELECT * FROM lawyers WHERE id = $1';

  emailSendInProgress = true;

  try {
    const { rows } = await pool.query(query, [lawyerId]);
    const lawyer = rows[0];

    if (!lawyer) {
      responseMessage.message = 'Lawyer not found.';
      return res.status(404).json(responseMessage);
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      port: 465,
      auth: {
        user: 'ilegaladvice26@gmail.com',
        pass: 'dnfz hpgh rsfm pelx'
      },
      pool: true
    });

    const clientMailOptions = {
      from: 'ilegaladvice26@gmail.com',
      to: email,
      subject: 'Lawyer Details',
      text: `Greetings from iLegalAdvice. Details of your requested lawyer:
      Name: ${lawyer.name}
      Contact No: ${lawyer.c_no}
      Email id: ${lawyer.email}
      Office address: ${lawyer.address}`
    };

    const lawyerMailOptions = {
      from: 'ilegaladvice26@gmail.com',
      to: lawyer.email,
      subject: 'Client Details',
      text: `Greetings from iLegalAdvice. The following user has been trying to contact you:
      Name: ${name}
      Contact No: ${c_no}
      Email id: ${email}`
    };

    const [clientResult, lawyerResult] = await Promise.all([
      sendEmailWithRetry(clientMailOptions, transporter),
      sendEmailWithRetry(lawyerMailOptions, transporter)
    ]);

    if (!clientResult.success || !lawyerResult.success) {
      throw new Error(clientResult.error || lawyerResult.error);
    }

    const insertQuery = `
      INSERT INTO lawyer_requests (lawyer_id, user_name, user_email, user_phone)
      VALUES ($1, $2, $3, $4)
    `;
    await pool.query(insertQuery, [lawyerId, name, email, c_no]);

    responseMessage = { success: true, message: 'Email sent successfully!' };

  } catch (error) {
    console.error('Error:', error);
    responseMessage.message = 'Error sending email. Please try again later.';

  } finally {
    emailSendInProgress = false;
    res.json(responseMessage);
  }
});



 app.post('/forgetpassword',async(req,res)=>{
   const email = req.body.email;
   if(emailSendInProgress){
    return res.json({
      success: false,
      message: 'Reset link is already being sent, please check your mail.'
    })
   }
   emailSendInProgress = true;
   let responseMessage = {
    success: false,
    message: 'An error occurred while sending the reset link. Please try again later.'
  }
   
   try{
    const result1 = await pool.query('SELECT FROM lawyers where email = $1',[email]);
    const result2 = await pool.query('SELECT FROM clientsignup where email = $1',[email]);

    if(result1.rows.length>0){
      const token = crypto.randomBytes(20).toString('hex');
      const query = 'UPDATE lawyers SET token = $2, expires_at = NOW() + INTERVAL \'1 hour\' WHERE email = $1'
      await pool.query( query,[email,token]);
      await sendPasswordResetEmail(email, token);
        responseMessage = {
        success: true,
        message: 'Password reset link sent to your email, please check your email.',
      };
   } 
    else if (result2.rows.length>0){
      const token = crypto.randomBytes(20).toString('hex');
      const query = 'UPDATE clientsignup SET token = $2, expires_at = NOW() + INTERVAL \'1 hour\' WHERE email = $1'
      await  pool.query(query,[email,token])
      await sendPasswordResetEmail(email, token)
        responseMessage = {
        success: true,
        message: 'Password reset link sent to your email, please check your email.',
      };
      }
    else{
        responseMessage = {
        success: false,
        message: 'Account not found, please verify your email.',
      };
    }
   }
   
   catch(error){
    console.error('Error sending email:', email);
   } finally{
    emailSendInProgress = false;
    res.json(responseMessage); 
   }
 });
   
 function sendPasswordResetEmail(email,token){
  return new Promise((resolve,reject)=>{
    const transporter = nodemailer.createTransport({
      service: 'gmail', 
      port: 465,
      auth: {
        user: 'ilegaladvice26@gmail.com', 
        pass: 'dnfz hpgh rsfm pelx' 
      },
      pool: true
    });

    const resetLink = `https://www.ilegaladvice.com/reset-password?token=${token}`;
   const mailOptions= {
    from: 'ilegaladvice26@gmail.com',
    to: email, 
    subject: 'Password Reset',
    text: `Click the following link to reset your password: https://www.ilegaladvice.com/reset-password?token=${token}`
   };

   
  transporter.sendMail(mailOptions,(error,info)=>{
    if(error) {
       console.error('Error sending email:',error);
       reject(error); 
    }  else {
       console.log('Email sent: ', info.response);
       resolve();
    }
  });
});
}  



app.post('/reset-password/:token',async(req,res)=>{
  try{
    bcrypt.hash(req.body.password,saltRounds,async function (err, hash) {
        const { token } = req.params;
        const password = hash;
        const query2 = 'SELECT email FROM clientsignup WHERE token = $1';
        const query1 = 'SELECT email FROM lawyers WHERE token = $1';
        const result2 = await pool.query(query2, [token]);
        const result1 = await pool.query(query1, [token]);

        if (result1.rowCount > 0) {
          const query = 'UPDATE lawyers SET passw = $1,cpassw = $1 WHERE token = $2 AND expires_at> NOW()';
          const result = await pool.query(query, [password, token]);
          if (result.rowCount === 0) {
            return res.redirect('/signup?toast=error&message=Invalid or expired token');
          }
          res.redirect('/signup');
        }
        else if (result2.rowCount > 0) {
          const query = 'UPDATE clientsignup SET passw = $1, cpassw = $1 WHERE token = $2 AND expires_at> NOW()';
          const result = await pool.query(query, [password, token]);
          if (result.rowCount === 0) {
            return res.redirect('/signup?toast=error&message=Invalid or expired token');
          }
          return res.redirect('/signup?toast=success&message=Password reset successfully');
        }
        else {
          return res.redirect('/signup?toast=error&message=Invalid token');
        }
      })
  } catch (error) {
    console.error('Error:', error);
    return res.redirect('/signup?toast=error&message=Failed to reset password');
  }
})

app.post('/submit-article',isuAuthenticated,async(req,res)=>{
  const {title, content} = req.body;
  const userId = req.user.id;
  console.log(userId);
  try{
    const result = await pool.query('insert into articles (title, content, author_id) values($1, $2, $3)',[title, content, userId])
  } catch(error){
     console.error('Error inserting article:',error);
     res.status(500).send('Internal server error');
  }
})

app.post('/toggle-like',ensureAuthenticated,async(req,res)=>{
  const userId = req.user.id;
  const user_role = req.user.role;
  const articleId = req.body.articleId;
  const client = await pool.connect();
try {
  await client.query('BEGIN');
   const likeResult = await client.query(`select * from likes where user_id=$1 and article_id=$2 and user_role=$3`,[userId,articleId,user_role]);
   let liked;
   if(likeResult.rows.length>0){
     await client.query(`delete from likes where user_id=$1 and article_id=$2 and user_role=$3`,[userId,articleId,user_role]);
     liked= false;
   } else{
    await client.query(`insert into likes (user_id,article_id,user_role) values ($1,$2,$3)`,[userId,articleId,user_role]);
    liked = true;
   }
   const countQuery = `select count(*) as like_count from likes where article_id=$1`;
   const countResult = await client.query(countQuery,[articleId]);
   const likeCount = countResult.rows[0].like_count;
    await client.query('COMMIT');
   res.json({success: true,likeCount,liked});
} catch(error){
  await pool.query('ROLLBACK');
  console.error('Error toggling like:',error);
  res.status(500).json({success:false,error:'internal server error'});
} finally{
  client.release();
}
})

app.post('/logOut',(req,res)=>{
  req.session.destroy((err)=>{
    if(err) {
      return res.redirect('/userAccount');
    }
    res.json({success: true, message: "User logged out successfully!"})
  })
})

app.post('/userAccount',isuAuthenticated, upload.single('image'),async function(req,res){
  const client = await pool.connect();
 try{
  await client.query('BEGIN');
  // console.log(req.body);
  // console.log(req.file);
  const name= req.body.name;
  const email= req.body.email;
  const passw= req.body.passw;
  const c_no= req.body.c_no;
  const yrs_exp =req.body.yrs_exp;
  const area_of_prac = req.body.areaofpractice;
  const courts = req.body.courts;
  const state = req.body.state;
  const city = req.body.city;
  const cpassw = req.body.cpassw;
  const language = req.body.language;
  const bio = req.body.bio;
  const userId = req.user.id;
  const address = req.body.address
  const {title, content} = req.body;
  // console.log(userId); 
  let updateFields = [];
  let updateParams = [];
  let paramIndex = 1;

  if (name){
    updateFields.push(`name=$${paramIndex++}`);
    updateParams.push(name);
  } 
  if (email){
    updateFields.push(`email=$${paramIndex++}`);
    updateParams.push(email);
  } 
  if (yrs_exp){
    updateFields.push(`yrs_exp=$${paramIndex++}`);
    updateParams.push(yrs_exp);
  } 
  if (c_no){
    updateFields.push(`c_no=$${paramIndex++}`);
    updateParams.push(c_no);
  } 
  if (courts){
    updateFields.push(`courts=$${paramIndex++}`);
    updateParams.push(courts);
  } 
  if (city){
    updateFields.push(`city=$${paramIndex++}`);
    updateParams.push(city);
  } 
  if (area_of_prac){
    updateFields.push(`area_of_prac=$${paramIndex++}`);
    updateParams.push(area_of_prac);
  } 
  if (state){
    updateFields.push(`states=$${paramIndex++}`);
    updateParams.push(state);
  }
  if (language){
    updateFields.push(`language=$${paramIndex++}`);
    updateParams.push(language);
  } 
  if (bio){
    updateFields.push(`bio=$${paramIndex++}`);
    updateParams.push(bio);
  }
 
  if (req.file){
    updateFields.push(`image=$${paramIndex++}`);
    updateParams.push(req.file.path);
  } 
  if (passw  && cpassw){
    if(passw !== cpassw){
      return res.status(400).json({success: false, message:'Password and confirm password do not match!'})
    }
    const hashedPassword = await bcrypt.hash(passw,saltRounds);
    updateFields.push(`passw=$${paramIndex++}`);
    updateParams.push(hashedPassword);
  } else if (passw || cpassw){
    return res.status(400).json({success: false, message: 'Both password and confirm password are required!'})
  }
 
  
  if(address){
    let location;
    try{
      location = await geocodeAddress(address);
      const latitude  = location ? location.lat : null;
      const longitude = location ? location.lng : null;
      updateFields.push(`address=$${paramIndex++}`);
      updateFields.push(`latitude=$${paramIndex++}`);
      updateFields.push(`longitude=$${paramIndex++}`);
      updateParams.push(address,latitude, longitude)

    } catch(error){
      console.error('Geocoding failed:',error);
      updateFields.push(`address=$${paramIndex++}`)
      updateFields.push(`latitude = NULL`);
      updateFields.push(`longitude = NULL`);
      updateParams.push(address);
    }
  }
  
  if (updateFields.length>0){ 
    let updateQuery;
    if(req.user.role==='lawyer'){
      updateQuery= `update lawyers set ${updateFields.join(', ')} where id= $${paramIndex}`;
    } else if(req.user.role==='client'){
      updateQuery= `update clientsignup set ${updateFields.join(', ')} where id= $${paramIndex}`;
    }
    updateParams.push(userId);
    await client.query(updateQuery, updateParams);
  }
  
  if(title && content){
    await client.query('insert into articles (title, content, author_id) values($1, $2, $3)',[title, content, userId]);
    await client.query('COMMIT');
    return res.json({success: true, message: 'Article Uploaded successfully!'})
  }
  await client.query('COMMIT');
  res.json({success: true, message: 'Profile updated successfully!'})
} catch (error){
  await client.query('ROLLBACK')
    console.error('error updating profile:',error);
    res.status(500).json({success: false,message: 'Internal server error'})
  } finally{
    client.release();
  }
})

app.post('/delArticle',async(req,res)=>{
 
  try{
    const articleId = req.query.articleId;
    const result = await pool.query('DELETE FROM articles WHERE id = $1', [articleId]);

    if (result.rowCount > 0) {
        res.json({ success: true, message: 'Article deleted successfully' });
    } else {
        res.json({ success: false, message: 'Article not found' });
    }
  } catch(error){
    console.error('Error deleting article:',error.stack);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
})


passport.use('client-login',new LocalStrategy({
   usernameField: 'lo_email',
   passwordField: 'lo_password'
},
  
async(email, password, done)=>{
    // console.log(email);
    // console.log(password);
  try{
    const clientUser = await pool.query('SELECT  email,id,passw,c_no,role FROM clientsignup WHERE email = $1', [email]);
    if (clientUser.rows.length > 0) {
      const user = clientUser.rows[0];
      const match = await bcrypt.compare(password, user.passw);
      if (match) {
        return done(null, user);
      } else {
        return done(null, false, { message: 'Invalid password' });
      }
    } else {
      const lawyerUser = await pool.query('SELECT id,email, passw,name,c_no,yrs_exp,bio,area_of_prac,image,role FROM lawyers WHERE email = $1', [email]);
      if (lawyerUser.rows.length > 0) {
        const user = lawyerUser.rows[0];
        const match = await bcrypt.compare(password, user.passw);
        if (match) {
          return done(null, user);
        } else {
          return done(null, false, { message: 'Invalid password' });
        }
      } else {
        return done(null, false, { message: 'User not found' });
      }
    }
} catch(error){
  return done(error);
}
}
));

passport.serializeUser((user, done)=>{
  // console.log('serializing user: ',user);
  done(null, {id: user.id, role:user.role});
});

passport.deserializeUser(async (user,done)=>{
  // console.log(user.id);
  // console.log('deserializing user:', user);
  try{
    if(user.role==='client'){
      const result=  await pool.query('SELECT id,email,name,c_no,role from clientsignup where id= $1',[user.id]);
      done(null,result.rows[0]);
    } else if(user.role==='lawyer'){
      const result = await pool.query('select name,id, email,c_no,yrs_exp,bio,language,states,city,courts,area_of_prac,image,role from lawyers where id=$1',[user.id]);
      done(null,result.rows[0]);
    }
  } catch(error){
    done(error);
  }
});

app.listen(port,()=>{
    console.log(`Server running on http://localhost:${port}`);
});    



