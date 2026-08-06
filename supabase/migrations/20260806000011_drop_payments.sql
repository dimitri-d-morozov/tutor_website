-- Убираем оплату из продукта целиком: "ничего про деньги на сайте не нужно".
-- Тариф ученика (student_profiles.tariff) — это не оплата, а описание условий
-- занятий, остаётся.

drop policy pay_select      on payments;
drop policy pay_write_tutor on payments;

drop table payments;
drop type payment_status;
