( function () {

	const PointPatternShader = {
		uniforms: {
			resolution: {
				value: new THREE.Vector2( 1, 1 )
			},
			opacity: {
				value: 0.8
			},
			radius: {
				value: 0.25
			},
			r : {
				value: 1.0
			},
			g : {
				value: 0.0
			},
			b : {
				value: 0.0
			},
			u_time : {
				value: 0.0
			} 
		},
		vertexShader:
  /* glsl */
  `

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,
		fragmentShader:
  /* glsl */
  `
  		uniform vec2 resolution; 
		uniform float opacity;
		uniform float radius;
		uniform float r;
		uniform float g;
		uniform float b;
		uniform float u_time;

		const float PI = 3.1415926535897932384626433832795;

		vec2 movingTiles(vec2 _st, float _zoom, float _speed){
			_st *= _zoom;
			return fract(_st);
		}

		void main() {
			vec2 st = gl_FragCoord.xy/(resolution.xy);
			st.x *= resolution.x/resolution.y;
		
			st = movingTiles(st, 100.0, 1.500);
			
			float dist = distance(st, vec2(0.5));
			dist = step(dist, radius);
			gl_FragColor = opacity * vec4(vec3(r,g,b), dist);
		}`
	};

	THREE.PointPatternShader = PointPatternShader;

} )();
