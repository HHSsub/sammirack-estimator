# 스텐랙 선반 재고 데이터 마이그레이션 가이드

## 개요
스텐랙 선반의 재고관리를 W(너비)만으로 통합하는 마이그레이션 스크립트입니다.
- 기존: `스텐랙-선반-사이즈43x90`, `스텐랙-선반-사이즈43x120` 등 (여러 개)
- 변경: `스텐랙-선반-43`, `스텐랙-선반-50` (2개로 통합)

## 실행 방법

### 방법 1: 로컬 파일 사용 (권장 - 안전)

1. **Gist에서 inventory.json 다운로드**
   - https://gist.githubusercontent.com/HHSsub/5f9bbee69fda5cad68fa0ced4b657f3c/raw/inventory.json
   - 브라우저에서 열어서 `inventory.json` 파일로 저장
   - 프로젝트 루트 디렉토리에 저장

2. **스크립트 실행**
   ```bash
   node scripts/migrate-stainless-shelf-inventory.js local inventory.json
   ```

3. **결과 확인**
   - `inventory.json` 파일이 업데이트됨
   - `inventory.json.backup.[타임스탬프]` 백업 파일 생성됨

4. **Gist에 수동 업로드**
   - 업데이트된 `inventory.json` 파일을 Gist에 업로드

### 방법 2: Gist API 직접 사용 (자동화)

**주의**: 이 방법은 Gist를 직접 수정하므로 신중하게 사용하세요.

1. **환경 변수 설정** (선택사항)
   - `.env` 파일 생성 (프로젝트 루트)
   ```env
   VITE_GITHUB_GIST_ID=your_gist_id
   VITE_GITHUB_TOKEN=your_github_token
   ```

2. **스크립트 실행**
   ```bash
   # 환경 변수 사용
   node scripts/migrate-stainless-shelf-inventory.js gist
   
   # 또는 명령줄에서 직접 지정
   node scripts/migrate-stainless-shelf-inventory.js gist YOUR_GIST_ID YOUR_GITHUB_TOKEN
   ```

3. **자동 처리**
   - Gist에서 자동 다운로드
   - 마이그레이션 실행
   - Gist에 자동 업로드
   - 로컬 백업 파일 생성

## 실행 전 확인사항

1. ✅ Node.js가 설치되어 있는지 확인
   ```bash
   node --version
   ```

2. ✅ 프로젝트 루트에서 실행하는지 확인
   ```bash
   cd C:\Users\삼미2\Downloads\sammirack-estimator
   ```

3. ✅ 백업이 생성되는지 확인 (자동 생성됨)

## 마이그레이션 내용

### 통합되는 항목

**선반(43)으로 통합:**
- `스텐랙-선반-사이즈43x90`
- `스텐랙-선반-사이즈43x120`
- `스텐랙-선반-사이즈43x150`
- `스텐랙-선반-사이즈43x180`
- `스텐랙-43x90선반-` (기타추가옵션, 있다면)
- `스텐랙-43x120선반-` (기타추가옵션, 있다면)
- → `스텐랙-선반-43` (합산)

**선반(50)으로 통합:**
- `스텐랙-선반-사이즈50x75`
- `스텐랙-선반-사이즈50x90`
- `스텐랙-선반-사이즈50x120`
- `스텐랙-선반-사이즈50x150`
- `스텐랙-선반-사이즈50x180`
- `스텐랙-선반-사이즈50x210`
- `스텐랙-50x75선반-` (기타추가옵션)
- `스텐랙-50x90선반-` (기타추가옵션)
- `스텐랙-50x120선반-` (기타추가옵션)
- `스텐랙-50x150선반-` (기타추가옵션)
- `스텐랙-50x180선반-` (기타추가옵션)
- → `스텐랙-선반-50` (합산)

## 문제 해결

### 오류: "재고 파일을 찾을 수 없습니다"
- 파일 경로를 확인하세요
- 프로젝트 루트에서 실행하는지 확인하세요

### 오류: "Gist ID 또는 GitHub Token이 설정되지 않았습니다"
- 방법 1 (로컬 파일)을 사용하거나
- 환경 변수를 설정하세요

### 마이그레이션 후 문제가 발생하면
- 백업 파일(`inventory.json.backup.[타임스탬프]`)을 복원하세요
- 백업 파일을 `inventory.json`으로 이름 변경

## 주의사항

⚠️ **중요**: 
- 마이그레이션은 **되돌릴 수 없습니다**
- 반드시 백업을 확인한 후 Gist에 업로드하세요
- 가격관리용 ID는 변경되지 않습니다 (재고관리만 통합)

