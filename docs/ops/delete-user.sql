-- 개인정보보호법 제36조 삭제 요청 처리용 SQL (Neon SQL Editor에 붙여 넣어 실행)
--
-- 사용법: 이 파일 안의 'user@example.com' 을 대상 사용자 이메일로 모두 바꾼다.
--         (따옴표는 그대로 둔다. 문장마다 같은 자리표시자가 쓰이므로 전부 바꿔야 한다.)
-- 같은 이메일의 사용자가 둘 이상이면 삭제 블록은 아무것도 지우지 않는다.
-- 삭제 범위: 그 사용자의 답변, 질문(질문에 달린 다른 사람의 답변 포함), 세션, 진도, 설정, 계정.

-- 1) 먼저 이것만 실행해 대상과 건수를 확인
SELECT u.id AS user_id,
       u.display_name,
       u.email,
       (SELECT count(*) FROM users WHERE email = 'user@example.com') AS user_match_count,
       (SELECT count(*) FROM questions q WHERE q.author_id = u.id) AS question_count,
       (SELECT count(*) FROM answers a WHERE a.author_id = u.id) AS answer_count,
       (SELECT count(*) FROM user_unit_reads r WHERE r.user_id = u.id) AS unit_read_count,
       (SELECT count(*) FROM user_card_levels c WHERE c.user_id = u.id) AS card_level_count,
       (SELECT count(*) FROM user_settings s WHERE s.user_id = u.id) AS settings_count
FROM users u
WHERE u.email = 'user@example.com';
-- user_match_count 가 1 이고 이름이 맞을 때만 아래로 진행한다. 0행이거나 2 이상이면 중단.

-- 2) 확인 후 이 블록 실행
BEGIN;

-- 그 사용자가 쓴 답변
DELETE FROM answers
WHERE author_id = (SELECT min(id) FROM users WHERE email = 'user@example.com' HAVING count(*) = 1);

-- 그 사용자가 쓴 질문 (질문에 달린 다른 사람의 답변은 ON DELETE CASCADE 로 함께 삭제)
DELETE FROM questions
WHERE author_id = (SELECT min(id) FROM users WHERE email = 'user@example.com' HAVING count(*) = 1);

-- 사용자 행 (세션, 진도, 설정은 ON DELETE CASCADE 로 함께 삭제)
DELETE FROM users
WHERE id = (SELECT min(id) FROM users WHERE email = 'user@example.com' HAVING count(*) = 1);

COMMIT;
