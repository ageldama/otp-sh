const lodash = require('lodash')
const JSONdb = require('simple-json-db')
const prompt = require('prompt')
const OtpAuth = require('otpauth')
const otplib = require('otplib')
const chalk = require('chalk')
const { table } = require('table')
const qrcode = require('qrcode')


class OtpMain {
  constructor(dbFilename='./db.json'){
    this.dbFilename = dbFilename
    this.db = new JSONdb(dbFilename, {
      asyncWrite: false,
      syncOnWrite: true,
      jsonSpaces: 4,
    })
  }

  __keys(){
    return lodash.sortBy(lodash.keys(this.db.JSON()))
  }

  genAll(){
    let cnt = 0
    const data = [
      [chalk.green('Idx'), chalk.cyan('Passcode'), 'Description'],
    ]

    for(const k of this.__keys()){
      cnt ++
      const {otpUri, desc} = JSON.parse(this.db.JSON()[k])
      const otp = OtpAuth.URI.parse(otpUri)
      // otpauth은 google authenticator와 호환 안됨.
      // webe에서 쓰는 github.com/pquerna/otp 와도 호환되지 않음.
      const passcode2 = otplib.authenticator.generate(otp.secret.base32)

      data.push([
        chalk.italic.green(cnt),
        chalk.bold.cyan(passcode2),
        desc
      ])
    }

    console.log(table(data))
  }

  addBySecret(secret, desc){
    const otp = new OtpAuth.TOTP({secret})
    const otpUri = otp.toString()
    this.db.set(secret, JSON.stringify({
      otpUri, desc,
    }))
    console.log(`${chalk.bgGreen.white.bold('Added')}: `, desc)
  }

  addByOtpUri(otpUri){
    const otp = OtpAuth.URI.parse(otpUri)
    const secret = otp.secret.base32
    const desc = `${otp.issuer} ${otp.label}`
    this.db.set(secret, JSON.stringify({
      otpUri, desc,
    }))
    console.log(`${chalk.bgBlue.white.bold('Added')}: `, desc)
  }

  deleteNth(nth){
    const k = this.__keys()[nth - 1]
    if(k){
      this.db.delete(k)
      console.log(`${chalk.bgRed.white.bold('Deleted')}: `, k)
    }
  }

  showNth(nth){
    const k = this.__keys()[nth - 1]
    if(k){
      const {otpUri, desc} = JSON.parse(this.db.JSON()[k])
      const otp = OtpAuth.URI.parse(otpUri)

      qrcode.toString(otpUri, {
        type: 'terminal', small: true,
      }, (err, url) => {
        console.log(url)
      })

      console.log('OTP URI:', chalk.yellow(otpUri))

      console.log(table([
        ['Idx', chalk.green(nth)],
        ['Description', desc],
        ['OTP Secret (Base32)', chalk.yellow(otp.secret.base32)],
      ]))
    }
  }
}


async function repl(){
  const otpMain = new OtpMain()

  while(true){
    prompt.message = ``
    prompt.delimiter = chalk.bold.white(`>`)

    const {cmd} = await prompt.get(['cmd'])
    try{
      //console.log(cmd)
      if(cmd === '?' || cmd === 'h' || cmd === 'help'){
        const helpKw = (s) => chalk.underline.yellow(s)
        const helpPh = (s) => chalk.italic.cyan(s)

        const helpData = [
          [`${helpKw('?')} | ${helpKw('h')} | ${helpKw('help')}`, `display help`],
          [`${helpKw('a')} ${helpPh('[OTP-SECRET]')} ${helpPh('[DESC]')}`, `add new OTP by OTP-Secret and Description`],
          [`${helpKw('u')} ${helpPh('[OTP-URI]')}`, `add new OTP by OTP URI`],
          [`${helpKw('d')} ${helpPh('[IDX]')}`, `delete an OTP by index`],
          [`${helpKw('s')} ${helpPh('[IDX]')}`, `show details of an OTP by index`],
          [`${helpKw('[anything else]')}`, `list registered OTPs and its generated passcode`],
        ]

        console.log(table(helpData))
      }else if(cmd.startsWith('a ')){
        const arr = cmd.split(/ /)
        otpMain.addBySecret(arr[1], arr[2])
      }else if(cmd.startsWith('u ')){
        const arr = cmd.split(/ /)
        otpMain.addByOtpUri(arr[1])
      }else if(cmd.startsWith('d ')){
        const arr = cmd.split(/ /)
        otpMain.deleteNth(Number(arr[1]))
      }else if(cmd.startsWith('s ')){
        const arr = cmd.split(/ /)
        otpMain.showNth(Number(arr[1]))
      }else{
        otpMain.genAll()
      }
    }catch(exc){
      console.log('Error:', exc)
    }
  }
}

(async () => {
  await repl()
})()
