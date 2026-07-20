---
name: ship-to-main
description: 이 저장소(세움디자인하우징 사이트)의 표준 배포 절차. 변경 작업을 마쳤을 때, 또는 사용자가 "배포", "올려줘", "머지", "반영", "ship", "PR 만들어 머지" 등을 요청할 때 사용한다. 작업 브랜치에 커밋·푸시한 뒤 **항상 새 PR을 main으로 생성해 머지**한다. main에 직접 커밋하지 않는다.
---

# ship-to-main

이 저장소의 모든 변경은 **항상 새 PR을 통해 `main`에 머지**한다. main 브랜치에 직접 커밋/푸시하지 않는다.

## 기본 정보
- 저장소: `actorjoon0001-glitch/scv-house-mall`
- 작업(피처) 브랜치: 현재 세션에 지정된 `claude/...` 브랜치를 그대로 사용한다 (특정 브랜치명을 하드코딩하지 않는다)
- 머지 대상(base): `main`
- 머지 방식: squash

## 상시 지시 (사용자 확정)
사용자가 **"항상 새 PR로 main에 자동머지"** 를 상시 지시했다. 변경 작업이 끝나면 사용자에게 배포 여부를 묻지 말고 커밋 → 푸시 → 새 PR 생성 → squash 머지까지 자동으로 수행한 뒤 결과만 보고한다.

## 절차
1. **작업 브랜치 확인**: 현재 피처 브랜치인지 확인. main이면 절대 직접 커밋하지 말고 피처 브랜치로 전환한다.
2. **커밋**: 변경을 명확한 메시지로 커밋한다. 커밋 메시지 끝에 세션이 요구하는 Co-Authored-By / Claude-Session 라인을 붙인다.
3. **푸시**: `git push -u origin <피처 브랜치>` (네트워크 오류 시 2s·4s·8s·16s 백오프로 최대 4회 재시도).
4. **새 PR 생성**: GitHub MCP `create_pull_request`로 `base=main`, `head=<피처 브랜치>` 새 PR을 만든다. 매번 새 PR을 만든다(기존 PR 재활용/스택 금지). PR 템플릿이 있으면 형식을 따른다.
5. **머지**: `merge_pull_request`(merge_method: squash)로 머지한다.
6. **충돌 처리**: 이전 squash 머지로 히스토리가 갈려 충돌이 나면 —
   `git fetch origin main` → `git merge -s ours origin/main -m "Merge main (keep feature work)"` → `git push` 후 다시 5단계 머지. (피처 브랜치 내용을 최종본으로 유지)
7. **보고**: 머지된 PR 링크와 결과를 사용자에게 보고한다.

## 주의
- PR은 사용자가 배포/머지를 원할 때만 만든다는 일반 규칙이 있으나, **이 저장소에서는 사용자가 "항상 새 PR로 main에 자동 머지"를 상시 지시**했으므로 변경 완료 시 이 절차를 기본으로 수행한다.
- GitHub 저장소 auto-merge 설정이 꺼져 있으면(필수 체크 없음) PR 생성 즉시 직접 머지한다.
- 기본 브랜치가 `main`이 아닐 수 있다. 화면 반영이 안 되면 사용자에게 GitHub Settings에서 기본 브랜치를, Netlify를 쓰면 프로덕션 브랜치를 `main`으로 맞추도록 안내한다.
