var container, stats;

var camera, controls, scene, renderer, composer;

var persistence = 'high', resolution = 'dk1';

var mesh;

var worldWidth = 128, worldDepth = 128,
worldHalfWidth = worldWidth / 2, worldHalfDepth = worldDepth / 2,
data = generateHeight( worldWidth, worldDepth );

var clock = new THREE.Clock();

var resolutions = {
	dk1: {w: 1280, h: 800},
	fhd: {w: 1920, h: 1080},
	cv1: {w: 2560, h: 1440}
};


var vignettePass, hblurPass, vblurPass, renderPass, copyPass, scanlinePass;

if (!Detector.webgl) {
	Detector.addGetWebGLMessage();
	document.getElementById( 'container').innerHTML = "";

} else {
	init();
	animate();
}

function init() {
	container = document.getElementById('container');

	camera = new THREE.PerspectiveCamera( 60, window.innerWidth / window.innerHeight, 1, 20000 );
	camera.position.y = getY( worldHalfWidth, worldHalfDepth ) * 100 + 100;

	controls = new THREE.FirstPersonControls( camera, container );

	setupUI();

	controls.movementSpeed = 1000;
	controls.lookSpeed = 0.125;
	controls.lookVertical = false; //temp
	controls.freeze = false; //tmp

	scene = new THREE.Scene();

	// sides

	var matrix = new THREE.Matrix4();

	var pxGeometry = new THREE.PlaneGeometry( 100, 100 );
	pxGeometry.faceVertexUvs[ 0 ][ 0 ][ 0 ].y = 0.5;
	pxGeometry.faceVertexUvs[ 0 ][ 0 ][ 2 ].y = 0.5;
	pxGeometry.faceVertexUvs[ 0 ][ 1 ][ 2 ].y = 0.5;
	pxGeometry.applyMatrix( matrix.makeRotationY( Math.PI / 2 ) );
	pxGeometry.applyMatrix( matrix.makeTranslation( 50, 0, 0 ) );

	var nxGeometry = new THREE.PlaneGeometry( 100, 100 );
	nxGeometry.faceVertexUvs[ 0 ][ 0 ][ 0 ].y = 0.5;
	nxGeometry.faceVertexUvs[ 0 ][ 0 ][ 2 ].y = 0.5;
	nxGeometry.faceVertexUvs[ 0 ][ 1 ][ 2 ].y = 0.5;
	nxGeometry.applyMatrix( matrix.makeRotationY( - Math.PI / 2 ) );
	nxGeometry.applyMatrix( matrix.makeTranslation( - 50, 0, 0 ) );

	var pyGeometry = new THREE.PlaneGeometry( 100, 100 );
	pyGeometry.faceVertexUvs[ 0 ][ 0 ][ 1 ].y = 0.5;
	pyGeometry.faceVertexUvs[ 0 ][ 1 ][ 0 ].y = 0.5;
	pyGeometry.faceVertexUvs[ 0 ][ 1 ][ 1 ].y = 0.5;
	pyGeometry.applyMatrix( matrix.makeRotationX( - Math.PI / 2 ) );
	pyGeometry.applyMatrix( matrix.makeTranslation( 0, 50, 0 ) );

	var pzGeometry = new THREE.PlaneGeometry( 100, 100 );
	pzGeometry.faceVertexUvs[ 0 ][ 0 ][ 0 ].y = 0.5;
	pzGeometry.faceVertexUvs[ 0 ][ 0 ][ 2 ].y = 0.5;
	pzGeometry.faceVertexUvs[ 0 ][ 1 ][ 2 ].y = 0.5;
	pzGeometry.applyMatrix( matrix.makeTranslation( 0, 0, 50 ) );

	var nzGeometry = new THREE.PlaneGeometry( 100, 100 );
	nzGeometry.faceVertexUvs[ 0 ][ 0 ][ 0 ].y = 0.5;
	nzGeometry.faceVertexUvs[ 0 ][ 0 ][ 2 ].y = 0.5;
	nzGeometry.faceVertexUvs[ 0 ][ 1 ][ 2 ].y = 0.5;
	nzGeometry.applyMatrix( matrix.makeRotationY( Math.PI ) );
	nzGeometry.applyMatrix( matrix.makeTranslation( 0, 0, -50 ) );

	//
	var geometry = new THREE.Geometry();
	var dummy = new THREE.Mesh();

	for ( var z = 0; z < worldDepth; z ++ ) {
		for ( var x = 0; x < worldWidth; x ++ ) {
			var h = getY( x, z );

			dummy.position.x = x * 100 - worldHalfWidth * 100;
			dummy.position.y = h * 100;
			dummy.position.z = z * 100 - worldHalfDepth * 100;

			var px = getY( x + 1, z );
			var nx = getY( x - 1, z );
			var pz = getY( x, z + 1 );
			var nz = getY( x, z - 1 );

			dummy.geometry = pyGeometry;
			THREE.GeometryUtils.merge( geometry, dummy );

			if ( ( px != h && px != h + 1 ) || x == 0 ) {
				dummy.geometry = pxGeometry;
				THREE.GeometryUtils.merge( geometry, dummy );
			}

			if ( ( nx != h && nx != h + 1 ) || x == worldWidth - 1 ) {
				dummy.geometry = nxGeometry;
				THREE.GeometryUtils.merge( geometry, dummy );
			}

			if ( ( pz != h && pz != h + 1 ) || z == worldDepth - 1 ) {
				dummy.geometry = pzGeometry;
				THREE.GeometryUtils.merge( geometry, dummy );
			}

			if ( ( nz != h && nz != h + 1 ) || z == 0 ) {
				dummy.geometry = nzGeometry;
				THREE.GeometryUtils.merge( geometry, dummy );
			}

		}

	}

	var texture = THREE.ImageUtils.loadTexture( 'textures/minecraft/atlas.png' );
	texture.magFilter = THREE.NearestFilter;
	texture.minFilter = THREE.LinearMipMapLinearFilter;

	var mesh = new THREE.Mesh( geometry, new THREE.MeshLambertMaterial( { map: texture, ambient: 0xbbbbbb } ) );
	scene.add( mesh );

	var ambientLight = new THREE.AmbientLight( 0xcccccc );
	scene.add( ambientLight );

	var directionalLight = new THREE.DirectionalLight( 0xffffff, 2 );
	directionalLight.position.set( 1, 1, 0.5 ).normalize();
	scene.add( directionalLight );

	renderer = new THREE.WebGLRenderer();
	renderer.setClearColor( 0xbfd1e5, 1 );
	renderer.setSize( window.innerWidth, window.innerHeight );

	// Here is the effect for the Oculus Rift
	// worldScale 100 means that 100 Units == 1m
	effect = new THREE.OculusRiftEffect( renderer, {worldScale: 100} );
	effect.setSize( window.innerWidth, window.innerHeight );


	//postprocessing
	renderPass = new THREE.RenderPass( scene, camera );

	vignettePass = new THREE.ShaderPass( THREE.VignetteShader );
	vignettePass.uniforms[ "darkness" ].value = 0.9;
	vignettePass.uniforms[ "offset" ].value = 0.9;

	hblurPass = new THREE.ShaderPass( THREE.HorizontalBlurShader );
	vblurPass = new THREE.ShaderPass( THREE.VerticalBlurShader );

	copyPass = new THREE.ShaderPass( THREE.CopyShader );

	filmPass = new THREE.ShaderPass( THREE.FilmShader );
	filmPass.uniforms["grayscale"].value = 0;
  filmPass.uniforms["time"].value = 0.0;

	scanlinePass = new THREE.ShaderPass( THREE.ScanlineShader );
	scanlinePass.uniforms["resolution"].value = new THREE.Vector2( 512, 512 );

	setupComposer(false);

	container.innerHTML = "";

	container.appendChild( renderer.domElement );

	stats = new Stats();
	stats.domElement.style.position = 'absolute';
	stats.domElement.style.top = '0px';
	container.appendChild( stats.domElement );

	// GUI
	window.addEventListener( 'resize', onWindowResize, false );
	document.addEventListener( 'keydown', keyPressed, false );

	guiVisible = true;
}

function onWindowResize() {
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();

	setupComposer(true);

	effect.setSize( window.innerWidth, window.innerHeight );

	controls.handleResize();
}

function keyPressed (event) {
	if (event.keyCode === 72) { // H
		guiVisible = !guiVisible;
		document.getElementById('info').style.display = guiVisible ? "block" : "none";
		stats.domElement.style.display = guiVisible ? "block" : "none";
	} else if (event.keyCode == 62) { // G
		controls.freeze = !controls.freeze;
	}
}

function generateHeight( width, height ) {

	var data = [], perlin = new ImprovedNoise(),
	size = width * height, quality = 2, z = Math.random() * 100;

	for ( var j = 0; j < 4; j ++ ) {
		if ( j == 0 ) for ( var i = 0; i < size; i ++ ) data[ i ] = 0;

		for ( var i = 0; i < size; i ++ ) {
			var x = i % width, y = ( i / width ) | 0;
			data[ i ] += perlin.noise( x / quality, y / quality, z ) * quality;
		}

		quality *= 4;
	}

	return data;
}

function getY( x, z ) {
	return ( data[ x + z * worldWidth ] * 0.2 ) | 0;
}

function setupComposer(reset) {
	composer = new THREE.EffectComposer( renderer );

	composer.addPass( renderPass );
	composer.addPass( vignettePass );

	if (persistence == 'high') {
		composer.addPass( hblurPass );
		composer.addPass( vblurPass );
	}

	if (resolution != 'cv2') {
		if (resolution == 'dk1') {
			filmPass.uniforms["time"].value = 0.0;
			filmPass.uniforms["nIntensity"].value = 1;
			filmPass.uniforms["sIntensity"].value = 0.5;
			filmPass.uniforms["sCount"].value = 1024;
		} else if (resolution == 'fhd') {
			filmPass.uniforms["time"].value = 0.0;
			filmPass.uniforms["nIntensity"].value = 1;
			filmPass.uniforms["sIntensity"].value = 0.5;
			filmPass.uniforms["sCount"].value = 2048;
		} else {
			filmPass.uniforms["time"].value = 0.0;
			filmPass.uniforms["nIntensity"].value = 1;
			filmPass.uniforms["sIntensity"].value = 0.5;
			filmPass.uniforms["sCount"].value = 8000;			
		}
		composer.addPass( scanlinePass );
		//composer.addPass( filmPass );
	} else {
		console.log('no film pass');
	}


	composer.addPass( copyPass );
	copyPass.renderToScreen = true;
}

function animate() {
	requestAnimationFrame( animate );

	render();
	stats.update();
}

function render() {
	controls.update( clock.getDelta() );
	composer.render();
	//effect.render( scene, camera );
}

function setupUI(){

	$('#resolution-select > div').on('click', function(ev){
		var $this = $(this);

		$this.parent().find('div').removeClass('selected');
		$this.addClass('selected');

		var r = $this.data('id');

		setResolution(r);
	});

	$('#toggle-persistence').on('click', function(ev){
		var $this = $(this);

		var val = $this.data('value');

		$this.toggleClass('selected');

		$this.data('value', (val == 'low')?'high':'low');

		setPersistence(val);

	});

	$('#toggle-drift').on('click', function(ev){
		var $this = $(this);
		$this.toggleClass('selected');

		setDrift(1);
	});

}

function setResolution(res) {
	console.log('set res: ' + res);

	resolution = res;
	setupComposer(true);
}

function setPersistence(level) {
	persistence = level;
	setupComposer(true);
}

function setDrift(drift) {
	camera.drift = drift;
}
