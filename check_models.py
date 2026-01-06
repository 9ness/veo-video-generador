import os
import json
import re
from google.oauth2 import service_account
from google.cloud import aiplatform
from google.cloud.aiplatform_v1.services.model_garden_service import ModelGardenServiceClient
from google.cloud.aiplatform_v1.types import ListPublisherModelsRequest

# Function to load env vars from .env.local manually
def load_env_local():
    env_path = '.env.local'
    if not os.path.exists(env_path):
        print(f"Error: {env_path} not found.")
        return None
    
    creds_json = None
    project_id = None
    
    with open(env_path, 'r', encoding='utf-8') as f:
        content = f.read()
        
        # Simple regex to find the JSON string. 
        # It usually starts with GOOGLE_SERVICE_ACCOUNT_JSON='{ and ends with }'
        # We need to be careful with newlines in the private key.
        
        # Match GOOGLE_SERVICE_ACCOUNT_JSON='...' or "..."
        json_match = re.search(r"GOOGLE_SERVICE_ACCOUNT_JSON=['\"](\{.*?\})['\"]", content, re.DOTALL)
        if json_match:
            try:
                creds_json = json.loads(json_match.group(1))
            except json.JSONDecodeError as e:
                print(f"Error parsing JSON from env: {e}")

        # Match GOOGLE_CLOUD_PROJECT_ID
        proj_match = re.search(r"GOOGLE_CLOUD_PROJECT_ID=['\"]?(.*?)['\"]?(\n|$)", content)
        if proj_match:
            project_id = proj_match.group(1).strip()
            
    return creds_json, project_id

def list_models():
    creds_dict, project_id_env = load_env_local()
    
    if not creds_dict:
        print("Could not find GOOGLE_SERVICE_ACCOUNT_JSON in .env.local")
        return

    # Create credentials object
    credentials = service_account.Credentials.from_service_account_info(creds_dict)
    
    project_id = creds_dict.get('project_id') or project_id_env
    location = 'us-central1'
    
    print(f"Authenticating with project: {project_id}")
    
    # Initialize AI Platform
    aiplatform.init(project=project_id, location=location, credentials=credentials)
    
    # Use Model Garden Service (Publisher Models)
    # The client library might differ slightly depending on version, 
    # but accessing publisher models often requires ModelGardenServiceClient or similar.
    
    # Note: 'PublisherModel' interface is specific. 
    # Let's try to list standard publisher models.
    
    print("\nAttempting to list video models in Model Garden...")
    
    try:
        # direct access to GAPIC client for publisher models
        client = ModelGardenServiceClient(credentials=credentials)
        parent = f"publishers/google"
        
        # Only experimental/preview?
        # Sometimes full path is required: projects/{project}/locations/{location}/publishers/google
        # But Publisher models are usually global or regional specific.
        # Let's try constructing the parent path correctly.
        
        # Usually: "publishers/google"
        request = ListPublisherModelsRequest(parent="publishers/google")
        
        # This might return A LOT of models. We want to filter for 'video' or 'veo'.
        response = client.list_publisher_models(request=request)
        
        found_any = False
        print(f"\nScanning models for 'video', 'veo', 'imagen'...")
        
        for model in response:
            name = model.name
            display_name = model.model_id # or display_name
            
            # Check keywords
            keywords = ['video', 'veo', 'move', 'motion']
            if any(k in name.lower() for k in keywords) or any(k in model.resource_name.lower() for k in keywords):
                print(f" - Found: {model.name} (ID: {model.model_id})")
                found_any = True
                
        if not found_any:
            print("No models found matching 'video' or 'veo'. Listing first 10 generic models to verify connection:")
            for i, model in enumerate(response):
                if i >= 10: break
                print(f" - {model.model_id}")

    except Exception as e:
        print(f"\nError listing models: {e}")
        print("Tip: Ensure the 'Vertex AI API' is enabled in your Google Cloud Project.")

if __name__ == "__main__":
    list_models()
