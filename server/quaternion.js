export class Quaternion {
  constructor(x = 0, y = 0, z = 0, w = 1) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.w = w;
  }

  set(x, y, z, w) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.w = w;
    return this;
  }

  copy(q) {
    this.x = q.x;
    this.y = q.y;
    this.z = q.z;
    this.w = q.w;
    return this;
  }

  clone() {
    return new Quaternion(this.x, this.y, this.z, this.w);
  }

  identity() {
    this.set(0, 0, 0, 1);
    return this;
  }

  setFromEulerY(yaw) {
    const halfYaw = yaw * 0.5;
    this.set(
      0,
      Math.sin(halfYaw),
      0,
      Math.cos(halfYaw)
    );
    return this;
  }

  setFromEuler(yaw, pitch, roll) {
    const cy = Math.cos(yaw * 0.5);
    const sy = Math.sin(yaw * 0.5);
    const cp = Math.cos(pitch * 0.5);
    const sp = Math.sin(pitch * 0.5);
    const cr = Math.cos(roll * 0.5);
    const sr = Math.sin(roll * 0.5);

    this.w = cr * cp * cy + sr * sp * sy;
    this.x = sr * cp * cy - cr * sp * sy;
    this.y = cr * sp * cy + sr * cp * sy;
    this.z = cr * cp * sy - sr * sp * cy;

    return this;
  }

  multiply(q) {
    const ax = this.x, ay = this.y, az = this.z, aw = this.w;
    const bx = q.x, by = q.y, bz = q.z, bw = q.w;

    this.x = ax * bw + aw * bx + ay * bz - az * by;
    this.y = ay * bw + aw * by + az * bx - ax * bz;
    this.z = az * bw + aw * bz + ax * by - ay * bx;
    this.w = aw * bw - ax * bx - ay * by - az * bz;

    return this;
  }

  dot(q) {
    return this.x * q.x + this.y * q.y + this.z * q.z + this.w * q.w;
  }

  lengthSq() {
    return this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w;
  }

  length() {
    return Math.sqrt(this.lengthSq());
  }

  normalize() {
    let len = this.length();
    if (len === 0) {
      this.x = 0;
      this.y = 0;
      this.z = 0;
      this.w = 1;
    } else {
      len = 1 / len;
      this.x *= len;
      this.y *= len;
      this.z *= len;
      this.w *= len;
    }
    return this;
  }

  invert() {
    return this.conjugate().normalize();
  }

  conjugate() {
    this.x *= -1;
    this.y *= -1;
    this.z *= -1;
    return this;
  }

  slerp(qb, t) {
    if (t === 0) return this;
    if (t === 1) return this.copy(qb);

    const x1 = this.x, y1 = this.y, z1 = this.z, w1 = this.w;
    let x2 = qb.x, y2 = qb.y, z2 = qb.z, w2 = qb.w;

    let dot = w1 * w2 + x1 * x2 + y1 * y2 + z1 * z2;

    if (dot < 0) {
      w2 = -w2;
      x2 = -x2;
      y2 = -y2;
      z2 = -z2;
      dot = -dot;
    }

    const EPSILON = 0.0005;

    if (dot > 1 - EPSILON) {
      const result = this;
      result.x = x1 + t * (x2 - x1);
      result.y = y1 + t * (y2 - y1);
      result.z = z1 + t * (z2 - z1);
      result.w = w1 + t * (w2 - w1);
      return result.normalize();
    }

    const theta = Math.acos(dot);
    const sinTheta = Math.sin(theta);

    const ratioA = Math.sin((1 - t) * theta) / sinTheta;
    const ratioB = Math.sin(t * theta) / sinTheta;

    this.x = ratioA * x1 + ratioB * x2;
    this.y = ratioA * y1 + ratioB * y2;
    this.z = ratioA * z1 + ratioB * z2;
    this.w = ratioA * w1 + ratioB * w2;

    return this;
  }

  toEulerY() {
    const siny_cosp = 2 * (this.w * this.y + this.z * this.x);
    const cosy_cosp = 1 - 2 * (this.y * this.y + this.z * this.z);
    return Math.atan2(siny_cosp, cosy_cosp);
  }

  toEuler() {
    const x = this.x, y = this.y, z = this.z, w = this.w;

    const sinr_cosp = 2 * (w * x + y * z);
    const cosr_cosp = 1 - 2 * (x * x + y * y);
    const roll = Math.atan2(sinr_cosp, cosr_cosp);

    const sinp = 2 * (w * y - z * x);
    let pitch;
    if (Math.abs(sinp) >= 1) {
      pitch = Math.sign(sinp) * Math.PI / 2;
    } else {
      pitch = Math.asin(sinp);
    }

    const siny_cosp = 2 * (w * z + x * y);
    const cosy_cosp = 1 - 2 * (y * y + z * z);
    const yaw = Math.atan2(siny_cosp, cosy_cosp);

    return { x: roll, y: yaw, z: pitch };
  }

  angleTo(q) {
    const dot = this.dot(q);
    const absDot = Math.abs(dot);
    const clampedDot = Math.min(absDot, 1);
    return 2 * Math.acos(clampedDot);
  }

  static slerp(qa, qb, t, target) {
    const result = target || new Quaternion();
    result.copy(qa);
    result.slerp(qb, t);
    return result;
  }

  static fromEulerY(yaw) {
    return new Quaternion().setFromEulerY(yaw);
  }
}
