const express = require('express')
const mongoose = require('mongoose')
const cookieParser = require('cookie-parser')
const bodyParser = require('body-parser')
const otpGenerator = require('otp-generator')
const { sendMail } = require('./scripts/mail')
require('dotenv').config()

const app = express()
app.use(bodyParser.urlencoded({ extended: false }))
app.use(cookieParser());
app.set('view engine', 'ejs');
const port = process.env.PORT || 3000

const dbUrl = "mongodb+srv://admin:"+process.env.DBPASS+"@cluster0.okpzlrj.mongodb.net/?retryWrites=true&w=majority"
createConnection().then(() => console.log('Connected to Database')).catch(err => console.log(err))
async function createConnection() {
    await mongoose.connect(dbUrl)
}

const userSchema = new mongoose.Schema({
    name: String,
    roll: Number,
    email: String,
    otp : {data: String,time:Date} 
})

const User = mongoose.model('User',userSchema)

async function getEmail(roll) {
    const detail =  await User.findOne({roll:roll})
    return detail.email
}

// Route that will generate OTP
app.post('/authenticate/generateOTP',async (req,res) => {
    const roll = parseInt(req.body.roll)
    const otp = otpGenerator.generate(6,{specialChars:false,upperCaseAlphabets:false,lowerCaseAlphabets:false})
    const now = new Date()
    const time = now.getTime()
    getEmail(roll).then(async (email) => {
        sendMail(email,otp).then( async () => {
            console.log('OTP Send Successfully')
            await User.findOneAndUpdate({roll:roll},{otp:{data:otp,time:time}}).catch(err => {console.log(err);res.json({'status':false});return})
            res.json({'status':true})
        }).catch(err => {console.log(err);res.json({'status':'error'})})
    }).catch(err => {console.log(err);res.json({'status':'error'})})
    return
})

// Route to verify OTP
app.post('/authenticate',async (req,res) => {
    const roll = parseInt(req.body.roll)
    const otp = req.body.otp
    const now = new Date()
    const time = now.getTime()

    const student = await User.findOne({roll:roll})
    const otpSent = student.otp
    const timeDiff = (time - otpSent.time)/(1000*60)

    if (otp===otpSent.data && timeDiff <= 3) {
        res.json({'authenticated':true,'id':student._id.toString()})
        return
    }
    else {
        res.json({'authenticated':false})
        return
    }
})

app.get('/',async (req,res) => {
    if (req.cookies.token) {
        const id = req.cookies.token
        const user = await User.findById(id)
        res.send('hello ' + user.name)
    } else {
        res.render('index')
    }
})

app.listen(port,() => console.log(`Server is running on http://localhost:${port}`))
