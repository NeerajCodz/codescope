export default function Loading() {
    return (
        <div className="flex flex-col items-center justify-center h-screen bg-background">
            <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-border border-t-primary rounded-full animate-spin" />
                <p className="text-sm text-muted-foreground">Analyzing repository...</p>
            </div>
        </div>
    );
}
