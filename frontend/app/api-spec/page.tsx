import React from 'react';

export default function ApiSpecPage() {
    return (
        <div className="w-full h-screen flex flex-col">
            <div className="p-4 bg-gray-900 text-white shadow-md">
                <h1 className="text-2xl font-bold">Backend API Specification</h1>
                <p className="text-sm text-gray-400">Powered by FastAPI & Swagger UI</p>
            </div>
            <div className="flex-grow">
                <iframe
                    src="http://localhost:8000/docs"
                    className="w-full h-full border-none"
                    title="API Docs"
                />
            </div>
        </div>
    );
}
