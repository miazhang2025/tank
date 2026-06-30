// Shared GLSL noise / caustic helpers, used by the floor, back wall and water surface.
export const NOISE = /* glsl */ `
float hash21(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
float vnoise(vec2 p){
  vec2 i=floor(p), f=fract(p);
  vec2 u=f*f*(3.0-2.0*f);
  float a=hash21(i), b=hash21(i+vec2(1.0,0.0));
  float c=hash21(i+vec2(0.0,1.0)), d=hash21(i+vec2(1.0,1.0));
  return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
}
float fbm(vec2 p){ float s=0.0,a=0.5; for(int i=0;i<4;i++){ s+=a*vnoise(p); p*=2.02; a*=0.5; } return s; }
float caustic(vec2 uv, float t){
  vec2 w = vec2(fbm(uv*0.8 + t*0.13), fbm(uv*0.8 + vec2(3.1,1.7) - t*0.11));
  float n1 = fbm(uv*1.4 + w*1.6 + t*0.18);
  float n2 = fbm(uv*1.9 - w*1.3 - t*0.15);
  float c = clamp(1.0 - abs(n1 - n2)*2.3, 0.0, 1.0);
  c = pow(c, 4.0);
  float c2 = clamp(1.0 - abs(fbm(uv*3.1 + w*2.0 - t*0.22) - 0.5)*3.2, 0.0, 1.0);
  return c + pow(c2,3.0)*0.5;
}
`;
