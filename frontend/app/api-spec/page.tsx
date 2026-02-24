import React from 'react';

export default function ApiSpecPage() {
    return (
        <div style={{ width: '100%', height: '100vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: 16 }}>
                <h3 style={{ margin: 0 }}>Backend API Specification</h3>
                <p style={{ margin: '4px 0 0', opacity: 0.6, fontSize: 14 }}>Powered by FastAPI & Swagger UI</p>
            </div>
            <div style={{ flex: 1 }}>
                <iframe
                    src="http://localhost:8000/docs"
                    style={{ width: '100%', height: '100%', border: 'none' }}
                    title="API Docs"
                />
            </div>
        </div>
    );
}
