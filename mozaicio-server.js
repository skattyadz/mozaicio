var redis = require('redis')
  , redisClient = redis.createClient()
  , path = require('path')
  , http = require('http')
  , express = require('express')
  , fs = require('fs')
  , fs = require('jade')
  , magick = require('imagemagick');

var app = exports.app = express();

app.configure(function(){
  app.set('port', 3000);
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.static(path.join(__dirname, 'public')));
  app.use(express.logger('dev'));
  app.use(express.bodyParser());
});

app.get('/', function(req, res) {
  res.render('index', {});
});
// var lastOne;
app.post('/postImage', function(req, res) {
  var tempPath = req.files.displayImage.path
  
  // if (lastOne) {
    // tempPath = lastOne;
  // }
  // lastOne = tempPath;
  console.log(tempPath);
  // tempPath = '/tmp/a11c3640067f8fc43f908989171ff34a'
  
  magick.convert([tempPath, '-scale', '30x30^', '-gravity', 'Center', 'txt:'], function(err, stdout, stderr) {
    // magick.convert([tempPath, '-scale', '50x50^', '-gravity', 'Center', 'txt:'], function(err, stdout, stderr) {
    // console.log(err);
    // console.log(stdout);
    
    var lines = stdout.split("\n")
    var pixelRegex = /^(\d+),(\d+): \(([\d ]{3}),([\d ]{3}),([\d ]{3})/;
    var lastX = 0;
    var width;
    
    var pixels = lines.map(function(line, i) {
      if (i == 0 || !line) return;
      
      var pixel = line.match(pixelRegex);
      console.log(line)
      var x = +pixel[1];
      // var y = +pixel[2];
      var r = +pixel[3];
      var g = +pixel[4];
      var b = +pixel[5];
      
      if (x < lastX) {
        width = lastX+1
      }
      lastX = x;
      return {r:r, g:g, b:b};
    }).filter(function(p){return p}); 
    
    var images = [];
    var imagesFetched = 0;
    
    function closure(i) {
      getFlickrImageForColour(pixels[i], function(imageURL) {
        images[i]=imageURL;
    
        if (++imagesFetched == pixels.length) {
          res.render('postImage', {images:images, width: width});
        }
      });
    }
    for (var i = 0; i < pixels.length; i++) {
      closure(i);
    }
    
    // exec("/usr/local/bin/montage image1.jpg image2.jpg image3.jpg image4.jpg image5.jpg image6.jpg -tile x3  mosaic/montage.jpg");  
  });
  
});

app.get('/image_for_colour', function(req, res) {
  var rgb = {r: +req.param('r'), g: +req.param('g'), b: +req.param('b')};
  getFlickrImageForColour(rgb, function(imageURL) {
    if (imageURL)
      res.redirect(imageURL);
    else
      res.send(' ')
  });
});

http.createServer(app).listen(app.get('port'), function(){
  console.log("Express server listening on port " + app.get('port'));
});
  
function getFlickrImageForColour(colour, callback) {
  // 5 levels of accuracy:
  //  - 0.1:  25:25:25 (~15625 colours)
  //  - 0.08: 20:20:20 (~8000 colours)
  //  - 0.06: 15:15:15 (~3375 colours)         me too. what you up to?
  //  - 0.04: 10:10:10 (~1000 colours)
  //  - 0.02: 5:5:5 (~125 colours)
  
  var factors = [0.1, 0.08, 0.06, 0.04, 0.02, 0.01];
  function findImageWithAccuracy(factor, callback){
    var roundedColour = {
      r: Math.round(colour.r*factors[factor]),
      g: Math.round(colour.g*factors[factor]),
      b: Math.round(colour.b*factors[factor])
    }
    
    var key = 'mozaicio:images:'+factors[factor]+':'+roundedColour.r+':'+roundedColour.g+':'+roundedColour.b;
    redisClient.srandmember(key, function(err, member) {
      if (member) {
        callback && callback(member)
      } else {
        var newFactor = factor+1;
        // console.log(newFactor)
        if (newFactor < factors.length) {
          findImageWithAccuracy(newFactor, callback);
        } else {
          console.log('nope. Couldn\'t find');
          callback && callback('fail')
        }
      }
    });
  }
  
  findImageWithAccuracy(0, callback);
}