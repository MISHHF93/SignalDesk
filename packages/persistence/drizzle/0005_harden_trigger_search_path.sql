-- Pin the immutability trigger function's search_path so it cannot be
-- hijacked by a role that creates shadowing objects earlier in the path.
alter function public.reject_immutable_column_update() set search_path = '';
