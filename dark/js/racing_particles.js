jQuery(document).ready(function($){

var isMouseDown = false;

var emptySlot = "emptySlot", planeTop = "planeTop", planeBottom = "planeBottom";

var camera, scene, renderer;
var mouse = {x: 0, y: 0};
var camPos = {x: 0, y: 0, z: 10};

if (typeof racing_particles_mainId === 'undefined' || racing_particles_mainId === null) {
    racing_particles_mainId = mainId;
}

var mainArea = document.getElementById(racing_particles_mainId);
var createCanvas = mainArea.appendChild(document.createElement('canvas'));
createCanvas.setAttribute("id", "hero_raceing_line");	
var sw = $('#'+racing_particles_mainId).width(), sh = $('#'+racing_particles_mainId).height();

var cols = 20;
var rows = 20;
var gap = 30;
var size = {
	width: 40,
	height: 40,
	depth: 40,
}
var planeOffset = 250;
var allRowsDepth = rows * (size.depth + gap);
var allColsWidth = cols * (size.depth + gap);

var speedNormal = 1;
var speedFast = 34;
var speed = speedNormal;

var boxes = {
	planeBottom: [],
	planeTop: []
};
var boxes1d = [];

var textures = [
	new THREE.TextureLoader().load( "img/coins/btcBasic.png" ),
	new THREE.TextureLoader().load( "img/coins/litecoin-112.png" ),
	new THREE.TextureLoader().load( "img/coins/dash_108.png" ),
	new THREE.TextureLoader().load( "img/coins/doge_112.png" ),
	new THREE.TextureLoader().load( "img/coins/ether-108.png" ),
	new THREE.TextureLoader().load( "img/coins/reddcoin-108.png" ),
	new THREE.TextureLoader().load( "img/coins/primecoin-112.png" ),
	new THREE.TextureLoader().load( "img/coins/vertcoin-108.png" ),
	new THREE.TextureLoader().load( "img/coins/potcoin-112.png" ),
	new THREE.TextureLoader().load( "img/coins/NXT-112.png" )
	];
var coinColours = [
	{r:1,g:1,b:0.1},
	{r:0.8,g:0.8,b:0.8},
	{r:0,g:0.2,b:0.7},
	{r:0.8,g:0.8,b:0},
	{r:.3,g:.1,b:0.9},
	{r:1,g:0.1,b:0.1},
	{r:1,g:1,b:0.3},
	{r:0.1,g:1,b:0.1},
	{r:0.1,g:1,b:0.2},
	{r:0.8,g:0.8,b:2}
]	
var coinNum = 0;	

function num(min, max) { return Math.random() * (max - min) + min; }

function draw(props) {

	//var coinNum = Math.round(Math.random()*(textures.length-1));
	if (coinNum > coinColours.length-1) coinNum = 0;
	
	var colours = {
		slow: {
			r: coinColours[coinNum].r,
			g: coinColours[coinNum].g,
			b: coinColours[coinNum].b
		},
		fast: {
			r: num(0.9, 1.0),
			g: num(0.1, 0.7),
			b: num(0.2, 0.5)
		}
	}


	var uniforms = {
		r: { type: "f", value: colours.slow.r},
		g: { type: "f", value: colours.slow.g},
		b: { type: "f", value: colours.slow.b},
		distanceX: { type: "f", value: 1.0},
		distanceZ: { type: "f", value: 1.0},
		pulse: { type: "f", value: 0},
		speed: { type: "f", value: speed},
		//texture: { type: 't', value: texture },
		//textureSampler: {type: 't', value: texture}
	};
	
	var material = new THREE.ShaderMaterial( {
		uniforms: uniforms,
		vertexShader: vertexShader,
		fragmentShader: fragmentShader,
		//map: texture,
		defines         : {
			USE_MAP: true
		}
	});
	
	//material.uniforms.textureSampler.value = texture;
	//object.material.needsUpdate = true;
		
	var geometry = new THREE.BoxGeometry(props.width, props.height, props.depth);
	var geometryCoin = new THREE.BoxBufferGeometry(props.width*.6, props.height+1, props.depth*.6);
	
	var object = new THREE.Mesh(geometry, material);
	object.colours = colours;
	// add textured object with same geometry and linked as child		
	var materialCoin = new THREE.MeshLambertMaterial( { 
		color: 0xffffff, 
		map: textures[coinNum], 
		transparent:true,
		//side: THREE.FrontSide
		} );
	object.coinBlock = new THREE.Mesh(geometryCoin, materialCoin);
	object.add(object.coinBlock);
	
	coinNum++;
	
	return object;
}

	
var objectTest;	
var callbackFunction;	

$.fn.blocksInit = function(callbackFunction) {

	scene = new THREE.Scene();

	camera = new THREE.PerspectiveCamera( 100, sw / sh, 1, 10000 );
	scene.add( camera );

	renderer = new THREE.WebGLRenderer({canvas:document.getElementById('hero_raceing_line'),antialiasing:true,alpha: true});
	renderer.setSize( sw, sh );
		
	// boxes
	for (var j = 0, jl = rows; j < jl; j++) {
		boxes.planeBottom[j] = [];
		boxes.planeTop[j] = [];
		for (var i = 0, il = cols; i < il; i++) {
			boxes.planeBottom[j][i] = emptySlot;
			boxes.planeTop[j][i] = emptySlot;
		};
	};

	function createBox() {
		var xi = Math.floor(Math.random() * cols), xai = xi;
		var yi = Math.random() > 0.5 ? 1 : -1, yai = yi === -1 ? planeBottom : planeTop;
		var zi = Math.floor(Math.random() * rows), zai = zi;

		var x = (xi - cols / 2) * (size.width + gap);
		var y = yi * planeOffset;
		var z = zi * (size.depth + gap);

		if (boxes[yai][zai][xai] === emptySlot) {
			var box = draw(size);
			box.position.y = y;
			box.isWarping = false;
			box.offset = {x: x, z: 0};
			box.posZ = z;

			boxes[yai][zai][xai] = box;
			boxes1d.push(box);

			scene.add(box);
		}
	}

	for (var i = 0, il = rows * cols; i < il; i++) {
		createBox();
	};
	
	
	// my test
	/*var lastBox = boxes1d[boxes1d.length-1];
	var material2 = new THREE.MeshPhongMaterial( { 
		color: 0xffffff, 
		map: textures[Math.round(Math.random()*(textures.length-1))], 
		transparent:true,
		//side: THREE.FrontSide;
		} );
	var geometry2 = new THREE.BoxGeometry(200, 200, 200);
	var geometry3 = new THREE.BoxGeometry(182, 182, 182);
	objectTest = new THREE.Mesh(geometry2, lastBox.material);
	
	objectTest.tex = new THREE.Mesh(geometry2, material2);
	//objectTest.tex.position.y = lastBox.position.y;
	objectTest.tex.isWarping = false;
	//objectTest.tex.offset = {x: lastBox.offset.x, z: 0};
	//objectTest.tex.posZ = lastBox.posZ;
	objectTest.add(objectTest.tex);
	//scene.add(objectTest);*/
	
	
	// LIGHTS
	hemiLight = new THREE.HemisphereLight( 0xffffff, 0xffffff, 0.6 );
	//hemiLight.color.setHSL( 0.6, 1, 0.6 );
	//hemiLight.groundColor.setHSL( 0.095, 1, 0.75 );
	hemiLight.position.set( 0, 50, 0 );
	scene.add( hemiLight );
	hemiLightHelper = new THREE.HemisphereLightHelper( hemiLight, 10 );
	scene.add( hemiLightHelper );
	//
	dirLight = new THREE.DirectionalLight( 0xffffff, 1 );
	dirLight.color.setHSL( 0.1, 1, 0.95 );
	dirLight.position.set( -1, 1.75, 1 );
	dirLight.position.multiplyScalar( 30 );
	scene.add( dirLight );
	dirLight.castShadow = true;
	dirLight.shadow.mapSize.width = 2048;
	dirLight.shadow.mapSize.height = 2048;
	var d = 250;
	dirLight.shadow.camera.left = -d;
	dirLight.shadow.camera.right = d;
	dirLight.shadow.camera.top = d;
	dirLight.shadow.camera.bottom = -d;
	dirLight.shadow.camera.far = 3500;
	dirLight.shadow.bias = -0.0001;
	dirLightHeper = new THREE.DirectionalLightHelper( dirLight, 10 );
	scene.add( dirLightHeper );
	
	//scene.add( new THREE.AmbientLight( 0xCCCCCC ) );

	
		

	// GROUND
	function makeGround() {
		var groundGeo = new THREE.PlaneBufferGeometry( 10000, 10000 );
		var groundMat = new THREE.MeshPhongMaterial( { color: 0x000024, specular: 0x050505 } );
		//groundMat.color.setHSL( 0.095, 1, 0.75 );
		var ground = new THREE.Mesh( groundGeo, groundMat );
		ground.rotation.x = -Math.PI/2;
		ground.position.y = -290;
		scene.add( ground );
		ground.receiveShadow = true;
	}
	// SKYDOME
	function makeSky() {
		//var vertexShader = document.getElementById( 'vertexShader' ).textContent;
		//var fragmentShader = document.getElementById( 'fragmentShader' ).textContent;
		var uniforms = {
			topColor:    { value: new THREE.Color( 0x0077ff ) },
			bottomColor: { value: new THREE.Color( 0xffffff ) },
			offset:      { value: 33 },
			exponent:    { value: 0.6 }
		};
		uniforms.topColor.value.copy( hemiLight.color );
		//scene.fog.color.copy( uniforms.bottomColor.value );
		var skyGeo = new THREE.SphereBufferGeometry( 4000, 32, 15 );
		var skyMat = new THREE.ShaderMaterial( { vertexShader: vertexShaderSky, fragmentShader: fragmentShaderSky, uniforms: uniforms, side: THREE.BackSide } );
		var sky = new THREE.Mesh( skyGeo, skyMat );
		scene.add( sky );
	}
	makeGround();
	//makeSky();
	
	
	

	function listen(eventNames, callback) {
		for (var i = 0; i < eventNames.length; i++) {
			window.addEventListener(eventNames[i], callback);
		}
	}
	listen(["resize"], function(e){
	
		sw = $('#'+racing_particles_mainId).width();
		sh = $('#'+racing_particles_mainId).height();
		camera.aspect = sw / sh;
		camera.updateProjectionMatrix();
		renderer.setSize(sw, sh);
	});
	listen(["mousedown", "touchstart"], function(e) {
		//e.preventDefault();
		isMouseDown = true;
	});
	listen(["mousemove", "touchmove"], function(e) {
		e.preventDefault();
		if (e.changedTouches && e.changedTouches[0]) e = e.changedTouches[0];
		mouse.x = (e.clientX / sw) * 2 - 1;
		mouse.y = -(e.clientY / sh) * 2 + 1;
	});
	listen(["mouseup", "touchend"], function(e) {
		//e.preventDefault();
		isMouseDown = false;
	});

	render(0);
	callbackFunction();

}




function move(x, y, z) {
	var box = boxes[y][z][x];

	if (box !== emptySlot) {

		box.position.x = box.offset.x;
		box.position.z = box.offset.z + box.posZ;

		if (box.position.z > 0) {
			box.posZ -= allRowsDepth;
		}

		// return;
		// if (isMouseDown) return;
		if (!box.isWarping && Math.random() > 0.999) {

			var dir = Math.floor(Math.random() * 5), xn = x, zn = z, yn = y, yi = 0, xo = 0, zo = 0;
			switch (dir) {
				case 0 : xn++; xo = 1; break;
				case 1 : xn--; xo = -1; break;
				case 2 : zn++; zo = 1; break;
				case 3 : zn--; zo = -1; break;
				case 4 :
					yn = (y === planeTop) ? planeBottom : planeTop;
					yi = (y === planeTop) ? -1 : 1;

					break;
			}

			if (boxes[yn][zn] && boxes[yn][zn][xn] === emptySlot) {

				boxes[y][z][x] = emptySlot;

				box.isWarping = true;

				boxes[yn][zn][xn] = box;

				// con.log( box.offset.x,  box.offset.z);

				if (dir === 4) { // slide vertically
					TweenMax.to(box.position, 0.5, {
						y: yi * planeOffset
					});
				} else { // slide horizontally
					TweenMax.to(box.offset, 0.5, {
						x: box.offset.x + xo * (size.width + gap),
						z: box.offset.z + zo * (size.depth + gap),
					});
				}
				TweenMax.to(box.offset, 0.6, {
					onComplete: function() {
						box.isWarping = false;
					}
				});

			}
		}

	}
}


function render(time) {

	speed -= (speed - (isMouseDown ? speedFast : speedNormal)) * 0.05;

	var box;
	for (var b = 0, bl = boxes1d.length; b < bl; b++) {
		box = boxes1d[b];
		box.posZ += speed;

		// normalized z distance from camera
		var distanceZ = 1 - ((allRowsDepth - box.posZ) / (allRowsDepth) - 1);
		box.material.uniforms.distanceZ.value = distanceZ;

		// normalized x distance from camera (centre)
		var distanceX = 1 - (Math.abs(box.position.x)) / (allColsWidth / 3);
		box.material.uniforms.distanceX.value = distanceX;

		//var colour = isMouseDown ? box.colours.fast : box.colours.slow;
		//box.material.uniforms.r.value -= (box.material.uniforms.r.value - colour.r) * 0.1;
		//box.material.uniforms.g.value -= (box.material.uniforms.g.value - colour.g) * 0.1;
		//box.material.uniforms.b.value -= (box.material.uniforms.b.value - colour.b) * 0.1;
		

		// normalized speed
		var currentSpeed = (speed - speedNormal) / (speedFast - speedNormal)
		box.material.uniforms.speed.value = currentSpeed;

		// pulses more with more speed... of course!
		if (Math.random() > (0.99995 - currentSpeed * 0.005)) {
			box.material.uniforms.pulse.value = 1;
		}
		box.material.uniforms.pulse.value -= box.material.uniforms.pulse.value * 0.1 / (currentSpeed + 1);

		// if (b ==13) con.log(box.material.uniforms.speed.value);
	}

	for (var j = 0, jl = rows; j < jl; j++) { // iterate through rows: z
		for (var i = 0, il = cols; i < il; i++) { // iterate throw cols: x
			move(i, planeBottom, j);
			move(i, planeTop, j);
		};
	};

	camPos.x -= (camPos.x - mouse.x * 400) * 0.02;
	camPos.y -= (camPos.y - mouse.y * 150) * 0.05;
	camPos.z = -100;
	camera.position.set(camPos.x, camPos.y, camPos.z);
	
	//objectTest.position.set(camPos.x, camPos.y, camPos.z - 1000);
	// camera.lookAt( objectTest.position );

	// camera.rotation.z = time * 0.0001;
	camera.rotation.y = camPos.x / -1000;
	camera.rotation.x = camPos.y / 1000;
	// camera.rotation.z = camPos.x / -2000;
	camera.rotation.z = (camPos.x - mouse.x * 400) / 2000;

	renderer.render( scene, camera );

	// if (time < 800)
	requestAnimationFrame( render );
}

var vertexShader = [
"varying vec2 vUv;",
"void main()",
"{",
"  vUv = uv;",
"  vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );",
"  gl_Position = projectionMatrix * mvPosition;",
"}"].join("");

var fragmentShader = [
"uniform float r;",
"uniform float g;",
"uniform float b;",
"uniform float distanceZ;",
"uniform float distanceX;",
"uniform float pulse;",
"uniform float speed;",

"varying vec2 vUv;",

// "float checkerRows = 8.0;",
// "float checkerCols = 16.0;",

"void main( void ) {",
"  vec2 position = abs(-1.0 + 2.0 * vUv);",
"  float edging = abs((pow(position.y, 5.0) + pow(position.x, 5.0)) / 2.0);",
"  float perc = (0.2 * pow(speed + 1.0, 2.0) + edging * 0.8) * distanceZ * distanceX;",

// "  float perc = distanceX * distanceZ;",
// "  vec2 checkPosition = vUv;",
// "  float checkerX = ceil(mod(checkPosition.x, 1.0 / checkerCols) - 1.0 / checkerCols / 2.0);",
// "  float checkerY = ceil(mod(checkPosition.y, 1.0 / checkerRows) - 1.0 / checkerRows / 2.0);",
// "  float checker = ceil(checkerX * checkerY);",
// "  float r = checker;",
// "  float g = checker;",
// "  float b = checker;",

// "  float perc = 1.0;",
"  float red = r * perc + pulse;",
"  float green = g * perc + pulse;",
"  float blue = b * perc + pulse;",
"  gl_FragColor = vec4(red, green, blue, 1.0);",
"}"].join("");
	
	
var vertexShaderSky = 
			"varying vec3 vWorldPosition; " +
			" void main() { " +
			"	vec4 worldPosition = modelMatrix * vec4( position, 1.0 );" +
			"	vWorldPosition = worldPosition.xyz;" +
			"	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );" +
			"}";
		

var fragmentShaderSky = 
			"uniform vec3 topColor; " +
			"uniform vec3 bottomColor; " +
			"uniform float offset; " +
			"uniform float exponent; " +
			"varying vec3 vWorldPosition; " +
			"void main() { " +
			"	float h = normalize( vWorldPosition + offset ).y; " +
			"	gl_FragColor = vec4( mix( bottomColor, topColor, max( pow( max( h , 0.0), exponent ), 0.0 ) ), 1.0 ); " +
			"}";
	

	
//console.log(THREE, TweenMax, planeTop, planeBottom);
//$.fn.blocksInit();
});