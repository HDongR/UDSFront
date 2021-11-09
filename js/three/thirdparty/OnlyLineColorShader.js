( function () {

	const OnlyLineColorShader = {
		uniforms: {
			resolution: {
				value: new THREE.Vector2( 1, 1 )
			},
			opacity: {
				value: 0.8
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
		uniform float r;
		uniform float g;
		uniform float b;
		uniform float u_time;

		void main() {
			//vec2 st = gl_FragCoord.xy/(resolution.xy);
			gl_FragColor = opacity * vec4(vec3(r,g,b), 0.);
		}`
	};

	THREE.OnlyLineColorShader = OnlyLineColorShader;

} )();
