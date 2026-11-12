-- Account / reference number and company website (for logos) on bills
alter table public.bills
  add column account_ref text check (account_ref is null or char_length(account_ref) <= 60),
  add column website text check (website is null or website ~* '^[a-z0-9.-]+\.[a-z]{2,}$');
comment on column public.bills.website is 'Company domain (e.g. eonnext.com), used to show the company logo';
