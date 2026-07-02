import fs from 'fs';

const filePath = 'src/panels/ProfilePanel.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const target = `              </div>
            </div>
          )}
          </div>
        </div>
      </div>`;

const replacement = `              </div>
            </div>
          </div>
        )}
        </div>
      </div>`;

const cleanContent = content.replace(/\r\n/g, '\n');
const cleanTarget = target.replace(/\r\n/g, '\n');
const cleanReplacement = replacement.replace(/\r\n/g, '\n');

if (cleanContent.includes(cleanTarget)) {
  const newContent = cleanContent.replace(cleanTarget, cleanReplacement);
  fs.writeFileSync(filePath, newContent.replace(/\n/g, '\r\n'), 'utf8');
  console.log("ProfilePanel final syntax fix completed.");
} else {
  console.error("Target string not found in ProfilePanel.tsx!");
}
