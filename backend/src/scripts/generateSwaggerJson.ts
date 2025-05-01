import fs from 'fs';
import path from 'path';
import { specs } from '../config/swagger';

// 출력 디렉토리 생성
const outputDir = path.join(__dirname, '../../swagger');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Swagger JSON 파일 생성
const outputPath = path.join(outputDir, 'swagger.json');
fs.writeFileSync(outputPath, JSON.stringify(specs, null, 2));

console.log(`Swagger JSON이 성공적으로 생성되었습니다: ${outputPath}`); 