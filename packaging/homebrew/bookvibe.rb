cask "bookvibe" do
  version "1.3.0"
  sha256 :no_check

  url "https://github.com/jhonrey-com/Bookvibe/releases/download/v#{version}/Bookvibe_#{version}_universal.dmg"
  name "Bookvibe"
  desc "Desktop book writing, proofreading, worldbuilding, and typesetting studio"
  homepage "https://github.com/jhonrey-com/Bookvibe"

  app "Bookvibe.app"

  zap trash: [
    "~/Library/Application Support/org.bookvibe.studio",
    "~/Library/Preferences/org.bookvibe.studio.plist",
  ]
end
