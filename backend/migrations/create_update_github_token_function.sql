-- Function to update GitHub access token
CREATE OR REPLACE FUNCTION update_github_token(p_firebase_uid TEXT, p_github_token TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    -- First try to update by firebase_uid
    UPDATE users
    SET github_access_token = p_github_token
    WHERE firebase_uid = p_firebase_uid;
    
    -- Check if any rows were affected
    IF FOUND THEN
        RETURN TRUE;
    END IF;
    
    -- If no rows were affected, try updating by id
    UPDATE users
    SET github_access_token = p_github_token
    WHERE id = p_firebase_uid;
    
    -- Return whether any rows were affected
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Function to execute raw SQL (use with caution)
CREATE OR REPLACE FUNCTION execute_sql(sql TEXT)
RETURNS VOID AS $$
BEGIN
    EXECUTE sql;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
