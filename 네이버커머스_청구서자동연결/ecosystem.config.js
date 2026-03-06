module.exports = {
    apps: [
        {
            name: "sammirack-listener",
            script: "order_listener.py",
            interpreter: "python3",
            cwd: "./",
            env: {
                PYTHONIOENCODING: "utf-8",
                NODE_ENV: "development"
            },
            log_date_format: "YYYY-MM-DD HH:mm:ss",
            error_file: "./logs/error.log",
            out_file: "./logs/out.log",
            combine_logs: true,
            autorestart: true,
            watch: false,
            max_memory_restart: "200M"
        }
    ]
};
