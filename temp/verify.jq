.[] | select(.name == "墨的扮演协议 - 状态栏版") | .prompts[] | select(.identifier == "status-bar-monitor") | {content}
