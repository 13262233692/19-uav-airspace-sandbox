export const UAVVertexShader = `
  precision highp float;
  
  uniform float uTime;
  uniform float uRotorSpeed;
  
  attribute float aMissionType;
  attribute float aSpeed;
  attribute float aUAVId;
  attribute float aConflictFlag;
  
  varying vec3 vNormal;
  varying vec3 vWorldPosition;
  varying float vMissionType;
  varying float vSpeed;
  varying vec3 vViewPosition;
  varying float vUAVId;
  varying float vConflictFlag;
  
  mat4 rotationMatrix(vec3 axis, float angle) {
    axis = normalize(axis);
    float s = sin(angle);
    float c = cos(angle);
    float oc = 1.0 - c;
    
    return mat4(
      oc * axis.x * axis.x + c,           oc * axis.x * axis.y - axis.z * s,  oc * axis.z * axis.x + axis.y * s,  0.0,
      oc * axis.x * axis.y + axis.z * s,  oc * axis.y * axis.y + c,           oc * axis.y * axis.z - axis.x * s,  0.0,
      oc * axis.z * axis.x - axis.y * s,  oc * axis.y * axis.z + axis.x * s,  oc * axis.z * axis.z + c,           0.0,
      0.0,                                0.0,                                0.0,                                1.0
    );
  }
  
  void main() {
    vNormal = normal;
    vMissionType = aMissionType;
    vSpeed = aSpeed;
    vUAVId = aUAVId;
    vConflictFlag = aConflictFlag;
    
    vec3 pos = position;
    vec3 transformedNormal = normal;
    
    float rotorY = 2.2;
    float bladeHalfLength = 1.75;
    float bladeHalfWidth = 0.15;
    float bladeHalfThickness = 0.025;
    
    float isBlade = 0.0;
    vec3 rotorCenter = vec3(0.0);
    
    vec3 absPos = vec3(abs(pos.x), abs(pos.y - rotorY), abs(pos.z));
    
    float inBladeX = step(absPos.y, bladeHalfThickness) * 
                     step(absPos.x, bladeHalfLength) * 
                     step(absPos.z, bladeHalfWidth);
    
    float inBladeZ = step(absPos.y, bladeHalfThickness) * 
                     step(absPos.z, bladeHalfLength) * 
                     step(absPos.x, bladeHalfWidth);
    
    float rotor1 = step(2.0, pos.x) * step(pos.x, 3.0) * inBladeX;
    float rotor2 = step(-3.0, pos.x) * step(pos.x, -2.0) * inBladeX;
    float rotor3 = step(2.0, pos.z) * step(pos.z, 3.0) * inBladeZ;
    float rotor4 = step(-3.0, pos.z) * step(pos.z, -2.0) * inBladeZ;
    
    isBlade = rotor1 + rotor2 + rotor3 + rotor4;
    
    if (rotor1 > 0.5) {
      rotorCenter = vec3(2.5, rotorY, 0.0);
    } else if (rotor2 > 0.5) {
      rotorCenter = vec3(-2.5, rotorY, 0.0);
    } else if (rotor3 > 0.5) {
      rotorCenter = vec3(0.0, rotorY, 2.5);
    } else if (rotor4 > 0.5) {
      rotorCenter = vec3(0.0, rotorY, -2.5);
    }
    
    if (isBlade > 0.5) {
      vec3 localPos = pos - rotorCenter;
      vec3 localNormal = transformedNormal;
      
      float baseSpeed = uRotorSpeed * (1.5 + aSpeed * 0.05);
      float angleOffset = aUAVId * 0.7;
      float direction = 1.0;
      
      if (rotor1 > 0.5) direction = -1.0;
      if (rotor2 > 0.5) direction = 1.0;
      if (rotor3 > 0.5) direction = 1.0;
      if (rotor4 > 0.5) direction = -1.0;
      
      float rotorAngle = uTime * baseSpeed * direction + angleOffset;
      
      mat4 rotorRotation = rotationMatrix(vec3(0.0, 1.0, 0.0), rotorAngle);
      localPos = (rotorRotation * vec4(localPos, 1.0)).xyz;
      localNormal = (rotorRotation * vec4(localNormal, 0.0)).xyz;
      
      pos = localPos + rotorCenter;
      transformedNormal = localNormal;
    }
    
    vec4 worldPosition = modelMatrix * instanceMatrix * vec4(pos, 1.0);
    
    float bobOffset = sin(uTime * 2.0 + aUAVId * 0.1) * 0.15;
    
    if (vConflictFlag > 0.5) {
      float pulse = sin(uTime * 15.0) * 0.5 + 0.5;
      bobOffset += pulse * 0.5;
    }
    
    worldPosition.y += bobOffset;
    
    vWorldPosition = worldPosition.xyz;
    
    vec4 mvPosition = viewMatrix * worldPosition;
    vViewPosition = -mvPosition.xyz;
    
    vNormal = normalize((modelMatrix * instanceMatrix * vec4(transformedNormal, 0.0)).xyz);
    
    gl_Position = projectionMatrix * mvPosition;
  }
`;

export const UAVFragmentShader = `
  precision highp float;
  
  uniform vec3 uMissionColors[6];
  uniform float uTime;
  
  varying vec3 vNormal;
  varying vec3 vWorldPosition;
  varying float vMissionType;
  varying float vSpeed;
  varying vec3 vViewPosition;
  varying float vUAVId;
  varying float vConflictFlag;
  
  void main() {
    vec3 normal = normalize(vNormal);
    vec3 lightDir = normalize(vec3(0.5, 1.0, 0.5));
    vec3 viewDir = normalize(vViewPosition);
    vec3 halfDir = normalize(lightDir + viewDir);
    
    float diff = max(dot(normal, lightDir), 0.0);
    float spec = pow(max(dot(normal, halfDir), 0.0), 64.0);
    
    int missionIndex = int(clamp(vMissionType + 0.5, 0.0, 5.0));
    missionIndex = clamp(missionIndex, 0, 5);
    
    vec3 baseColor = uMissionColors[missionIndex];
    vec3 warningColor = vec3(1.0, 0.1, 0.1);
    
    if (vConflictFlag > 0.5) {
      float pulse = sin(uTime * 15.0) * 0.5 + 0.5;
      float warningBlend = smoothstep(0.3, 0.7, pulse);
      baseColor = mix(baseColor, warningColor, warningBlend);
    }
    
    float heightFactor = clamp(vWorldPosition.y / 250.0, 0.3, 1.0);
    vec3 emissiveColor = baseColor * 0.15 * heightFactor;
    
    if (vConflictFlag > 0.5) {
      float pulse = sin(uTime * 15.0) * 0.5 + 0.5;
      emissiveColor = warningColor * (0.4 + pulse * 0.4);
    }
    
    float speedGlow = clamp(vSpeed / 40.0, 0.0, 1.0);
    emissiveColor += baseColor * speedGlow * 0.15;
    
    vec3 ambient = baseColor * 0.3;
    vec3 diffuse = baseColor * diff * 0.7;
    vec3 specular = vec3(1.0) * spec * 0.5;
    
    float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 3.0);
    vec3 rimColor = baseColor * fresnel * 0.4;
    
    if (vConflictFlag > 0.5) {
      rimColor = warningColor * fresnel * 0.8;
    }
    
    vec3 finalColor = ambient + diffuse + specular + emissiveColor + rimColor;
    
    float pulse = sin(uTime * 3.0 + vUAVId * 0.1) * 0.5 + 0.5;
    finalColor += baseColor * pulse * 0.05;
    
    if (vConflictFlag > 0.5) {
      float pulseFast = sin(uTime * 20.0) * 0.5 + 0.5;
      finalColor += warningColor * pulseFast * 0.2;
    }
    
    float dist = length(vViewPosition);
    float fogFactor = exp(-dist * 0.0003);
    vec3 fogColor = vec3(0.04, 0.04, 0.06);
    finalColor = mix(fogColor, finalColor, fogFactor);
    
    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

export const WarningLineVertexShader = `
  precision highp float;
  
  uniform float uTime;
  
  attribute vec3 aStart;
  attribute vec3 aEnd;
  attribute float aProgress;
  attribute float aDistance;
  
  varying float vAlpha;
  varying float vProgress;
  varying float vDistance;
  
  void main() {
    vProgress = aProgress;
    vDistance = aDistance;
    
    vec3 direction = normalize(aEnd - aStart);
    vec3 up = vec3(0.0, 1.0, 0.0);
    vec3 right = normalize(cross(direction, up));
    
    float t = position.x;
    vec3 pos = mix(aStart, aEnd, t);
    
    float width = 2.0 * position.y;
    pos += right * width;
    
    float lineAlpha = 1.0 - smoothstep(10.0, 20.0, aDistance);
    float fadeAlpha = smoothstep(0.0, 0.1, t) * (1.0 - smoothstep(0.9, 1.0, t));
    vAlpha = lineAlpha * fadeAlpha * 0.9;
    
    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

export const WarningLineFragmentShader = `
  precision highp float;
  
  uniform float uTime;
  uniform vec3 uColor;
  
  varying float vAlpha;
  varying float vProgress;
  varying float vDistance;
  
  void main() {
    vec3 color = uColor;
    
    float electricPulse = sin(vProgress * 20.0 - uTime * 10.0) * 0.5 + 0.5;
    electricPulse = pow(electricPulse, 2.0);
    
    float arcPulse = sin(vProgress * 10.0 - uTime * 5.0) * 0.5 + 0.5;
    arcPulse = smoothstep(0.3, 0.7, arcPulse);
    
    float spark = sin(vProgress * 50.0 + uTime * 15.0) * 0.5 + 0.5;
    spark = pow(spark, 3.0);
    
    vec3 electricColor = vec3(1.0, 0.3, 0.3);
    vec3 sparkColor = vec3(1.0, 1.0, 0.8);
    
    vec3 finalColor = mix(color, electricColor, electricPulse * 0.6);
    finalColor += sparkColor * spark * 0.5;
    finalColor += color * arcPulse * 0.3;
    
    float distFade = 1.0 - smoothstep(5.0, 15.0, vDistance);
    float alpha = vAlpha * (0.6 + electricPulse * 0.4) * distFade;
    
    gl_FragColor = vec4(finalColor, alpha);
  }
`;

export const ShieldVertexShader = `
  precision highp float;
  
  uniform float uTime;
  
  attribute vec3 aCenter;
  attribute float aRadius;
  
  varying float vAlpha;
  varying vec3 vNormal;
  varying vec3 vPosition;
  
  void main() {
    vNormal = normal;
    
    vec3 pos = position * aRadius * 1.2;
    pos += aCenter;
    
    float wave = sin(pos.x * 2.0 + uTime * 3.0) * 
                 sin(pos.y * 2.0 + uTime * 2.5) * 
                 sin(pos.z * 2.0 + uTime * 2.0) * 0.3;
    pos += normal * wave * 0.5;
    
    vPosition = pos;
    
    vAlpha = 0.25 + wave * 0.15;
    
    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

export const ShieldFragmentShader = `
  precision highp float;
  
  uniform float uTime;
  uniform vec3 uColor;
  
  varying float vAlpha;
  varying vec3 vNormal;
  varying vec3 vPosition;
  
  void main() {
    vec3 normal = normalize(vNormal);
    vec3 viewDir = normalize(cameraPosition - vPosition);
    
    float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 2.0);
    
    float hexPattern = sin(vPosition.x * 3.0 + uTime) * 
                       sin(vPosition.y * 3.0 + uTime * 0.7) * 
                       sin(vPosition.z * 3.0 + uTime * 0.5);
    hexPattern = smoothstep(-0.3, 0.3, hexPattern);
    
    vec3 baseColor = uColor;
    vec3 edgeColor = vec3(1.0, 0.5, 0.5);
    
    vec3 finalColor = mix(baseColor, edgeColor, fresnel);
    finalColor += baseColor * hexPattern * 0.3;
    
    float pulse = sin(uTime * 4.0) * 0.5 + 0.5;
    float alpha = vAlpha * (0.4 + fresnel * 0.6) * (0.7 + pulse * 0.3);
    
    gl_FragColor = vec4(finalColor, alpha);
  }
`;
